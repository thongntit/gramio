import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DataSource } from 'typeorm';
import configuredDataSource from '../src/data-source';
import {
  loadLearningContent,
  validateLearningContent,
} from '../src/database/content/learning-content.loader';
import {
  LearningContentBundle,
  LearningDeckSource,
} from '../src/database/content/learning-content.types';
import { seedLearningContentDatabase } from '../src/database/seeds/seed-learning-content';
import { seedLearningContent } from '../src/database/seeds/learning-content.seeder';
import { Card } from '../src/learning/entities/card.entity';
import { Deck, DeckType } from '../src/learning/entities/deck.entity';
import { ReviewEvent } from '../src/learning/entities/review-event.entity';
import {
  LearningStage,
  ReviewRating,
  UserCardProgress,
} from '../src/learning/entities/user-card-progress.entity';
import { UserDeck } from '../src/learning/entities/user-deck.entity';
import { User } from '../src/users/user.entity';

const ESSENTIAL_DECK_SLUG = 'essential-everyday-vocabulary';
const REPLACED_CARD_KEY = 'everyday-001';
const UPDATED_CARD_KEY = 'everyday-002';
const NEW_CARD_KEY = 'everyday-021';
const OMITTED_DECK_SLUG = 'common-prepositions';
const UPDATED_ANSWER =
  'Use something temporarily, then give it back to its owner.';

jest.setTimeout(30_000);

const safeCiEnvironment = {
  DATABASE_URL:
    'postgresql://openspeak:openspeak@localhost:5432/openspeak_test',
  NODE_ENV: 'test',
  ALLOW_DESTRUCTIVE_DB_TESTS: 'true',
};

function withDatabaseTestEnvironment(
  environment: Record<string, string | undefined>,
  action: () => void,
): void {
  const originalEnvironment = Object.fromEntries(
    Object.keys(environment).map((key) => [key, process.env[key]]),
  );

  try {
    for (const [key, value] of Object.entries(environment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    action();
  } finally {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function createTestDataSource(): DataSource {
  if (process.env.ALLOW_DESTRUCTIVE_DB_TESTS !== 'true') {
    throw new Error(
      'Destructive database tests require ALLOW_DESTRUCTIVE_DB_TESTS=true',
    );
  }
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Destructive database tests require NODE_ENV=test');
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  } catch {
    throw new Error(
      'Destructive database tests require a valid PostgreSQL DATABASE_URL',
    );
  }
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error(
      'Destructive database tests require a valid PostgreSQL DATABASE_URL',
    );
  }

  const encodedDatabaseName = databaseUrl.pathname.slice(1);
  let databaseName: string;
  try {
    databaseName = decodeURIComponent(encodedDatabaseName);
  } catch {
    throw new Error(
      'Destructive database tests require a database name clearly marked as test',
    );
  }
  if (
    !databaseName ||
    databaseName.includes('/') ||
    !/^(?:test|.+[_-]test)$/i.test(databaseName)
  ) {
    throw new Error(
      'Destructive database tests require a database name clearly marked as test',
    );
  }
  if (configuredDataSource.options.type !== 'postgres') {
    throw new Error('Learning content e2e tests require PostgreSQL');
  }

  return new DataSource({
    ...configuredDataSource.options,
    url: databaseUrl.toString(),
    logging: false,
  });
}

async function truncateLearningTables(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    TRUNCATE TABLE
      notification_subscriptions,
      review_events,
      user_card_progress,
      user_decks,
      cards,
      decks,
      users
  `);
}

async function captureLearningCounts(dataSource: DataSource) {
  const [decks, cards, enrollments, progress, reviews, users] =
    await Promise.all([
      dataSource.getRepository(Deck).count(),
      dataSource.getRepository(Card).count(),
      dataSource.getRepository(UserDeck).count(),
      dataSource.getRepository(UserCardProgress).count(),
      dataSource.getRepository(ReviewEvent).count(),
      dataSource.getRepository(User).count(),
    ]);

  return { decks, cards, enrollments, progress, reviews, users };
}

function cloneDeck(deck: LearningDeckSource): LearningDeckSource {
  return {
    ...deck,
    cards: deck.cards.map((card) => ({
      ...card,
      options: card.options ? [...card.options] : undefined,
    })),
  };
}

function writeInvalidCompleteBundle(contentDirectory: string): string[] {
  const decks = loadLearningContent()
    .decks.filter((deck) => deck.slug !== OMITTED_DECK_SLUG)
    .map(cloneDeck);
  decks[0].cards[0].answer = ' ';
  const deckFiles = decks.map((deck) => `${deck.slug}.json`);

  writeFileSync(
    path.join(contentDirectory, 'manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      namespace: 'starter',
      contentVersion: 'invalid-card-fixture',
      deckFiles,
    }),
  );
  decks.forEach((deck, index) => {
    writeFileSync(
      path.join(contentDirectory, deckFiles[index]),
      JSON.stringify(deck),
    );
  });

  return deckFiles;
}

function createUpdatedBundle(
  originalBundle: LearningContentBundle,
): LearningContentBundle {
  const decks = originalBundle.decks
    .filter((deck) => deck.slug !== OMITTED_DECK_SLUG)
    .map(cloneDeck);
  const essentialDeck = decks.find((deck) => deck.slug === ESSENTIAL_DECK_SLUG);
  if (!essentialDeck) {
    throw new Error(`Missing test deck ${ESSENTIAL_DECK_SLUG}`);
  }

  const updatedCard = essentialDeck.cards.find(
    (card) => card.contentKey === UPDATED_CARD_KEY,
  );
  if (!updatedCard) {
    throw new Error(`Missing test card ${UPDATED_CARD_KEY}`);
  }
  updatedCard.answer = UPDATED_ANSWER;

  const replacedCardIndex = essentialDeck.cards.findIndex(
    (card) => card.contentKey === REPLACED_CARD_KEY,
  );
  if (replacedCardIndex < 0) {
    throw new Error(`Missing test card ${REPLACED_CARD_KEY}`);
  }
  essentialDeck.cards[replacedCardIndex] = {
    ...essentialDeck.cards[replacedCardIndex],
    contentKey: NEW_CARD_KEY,
    front: 'What does “confirm” mean in “Please confirm your appointment”?',
    answer: 'Say or show that something is definite or correct.',
    explanation:
      'To “confirm” is to verify that an arrangement or fact is correct.',
    example: 'She confirmed the booking by email.',
  };

  return validateLearningContent(
    {
      schemaVersion: 1,
      namespace: 'starter',
      contentVersion: '2026.07.2',
      deckFiles: decks.map((deck) => `${deck.slug}.json`),
    },
    decks,
  );
}

describe('destructive database safety', () => {
  it.each([
    [
      'without explicit opt-in',
      { ...safeCiEnvironment, ALLOW_DESTRUCTIVE_DB_TESTS: undefined },
      /ALLOW_DESTRUCTIVE_DB_TESTS=true/,
    ],
    [
      'outside the test environment',
      { ...safeCiEnvironment, NODE_ENV: 'production' },
      /NODE_ENV=test/,
    ],
    [
      'against a database not marked as test',
      {
        ...safeCiEnvironment,
        DATABASE_URL: 'postgresql://openspeak:openspeak@localhost/openspeak',
      },
      /database name.*test/i,
    ],
    [
      'against an ambiguously marked database',
      {
        ...safeCiEnvironment,
        DATABASE_URL:
          'postgresql://openspeak:openspeak@localhost/openspeak_test_backup',
      },
      /database name.*test/i,
    ],
  ])(
    'rejects %s before initialize or destructive SQL',
    (_name, environment, expectedError) => {
      withDatabaseTestEnvironment(environment, () => {
        const initialize = jest.spyOn(DataSource.prototype, 'initialize');
        const query = jest.spyOn(DataSource.prototype, 'query');
        try {
          expect(() => createTestDataSource()).toThrow(expectedError);
          expect(initialize).not.toHaveBeenCalled();
          expect(query).not.toHaveBeenCalled();
        } finally {
          initialize.mockRestore();
          query.mockRestore();
        }
      });
    },
  );

  it('accepts the exact ephemeral CI database configuration without connecting', () => {
    withDatabaseTestEnvironment(safeCiEnvironment, () => {
      const initialize = jest.spyOn(DataSource.prototype, 'initialize');
      try {
        const testDataSource = createTestDataSource();

        expect(testDataSource.options).toMatchObject({
          type: 'postgres',
          url: safeCiEnvironment.DATABASE_URL,
        });
        expect(testDataSource.isInitialized).toBe(false);
        expect(initialize).not.toHaveBeenCalled();
      } finally {
        initialize.mockRestore();
      }
    });
  });
});

describe('learning content validation preflight', () => {
  it('reads a complete five-deck bundle before rejecting an invalid card field', () => {
    const invalidContentDirectory = mkdtempSync(
      path.join(tmpdir(), 'gramio-invalid-learning-content-'),
    );

    try {
      const deckFiles = writeInvalidCompleteBundle(invalidContentDirectory);

      expect(deckFiles).toHaveLength(5);
      expect(readdirSync(invalidContentDirectory).sort()).toEqual(
        ['manifest.json', ...deckFiles].sort(),
      );
      expect(() => loadLearningContent(invalidContentDirectory)).toThrow(
        /deckDocuments\[0\].*answer/,
      );
    } finally {
      rmSync(invalidContentDirectory, { recursive: true, force: true });
    }
  });
});

describe('learning content seed (e2e)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = createTestDataSource();
    await dataSource.initialize();
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await truncateLearningTables(dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('seeds cleanly and preserves stable identities on rerun', async () => {
    const bundle = loadLearningContent();

    const firstSummary = await seedLearningContent(dataSource, bundle);
    const secondSummary = await seedLearningContent(dataSource, bundle);

    expect(firstSummary).toEqual({
      contentVersion: 'starter@2026.07.2',
      decksUpserted: 6,
      cardsUpserted: 148,
      decksUnpublished: 0,
      cardsDeactivated: 0,
    });
    expect(secondSummary).toEqual(firstSummary);

    const deckRepository = dataSource.getRepository(Deck);
    const cardRepository = dataSource.getRepository(Card);
    const essentialDeck = await deckRepository.findOneByOrFail({
      slug: ESSENTIAL_DECK_SLUG,
    });

    expect(await deckRepository.count()).toBe(6);
    expect(await cardRepository.count()).toBe(148);
    expect(await deckRepository.countBy({ slug: ESSENTIAL_DECK_SLUG })).toBe(1);
    expect(
      await cardRepository.countBy({
        deck_id: essentialDeck.id,
        content_key: REPLACED_CARD_KEY,
      }),
    ).toBe(1);
  });

  it('updates managed content, retires omissions, and preserves history and foreign decks', async () => {
    const originalBundle = loadLearningContent();
    await seedLearningContent(dataSource, originalBundle);

    const deckRepository = dataSource.getRepository(Deck);
    const cardRepository = dataSource.getRepository(Card);
    const userRepository = dataSource.getRepository(User);
    const enrollmentRepository = dataSource.getRepository(UserDeck);
    const progressRepository = dataSource.getRepository(UserCardProgress);
    const reviewRepository = dataSource.getRepository(ReviewEvent);
    const essentialDeck = await deckRepository.findOneByOrFail({
      slug: ESSENTIAL_DECK_SLUG,
    });
    const replacedCard = await cardRepository.findOneByOrFail({
      deck_id: essentialDeck.id,
      content_key: REPLACED_CARD_KEY,
    });
    const omittedDeck = await deckRepository.findOneByOrFail({
      slug: OMITTED_DECK_SLUG,
    });
    const user = await userRepository.save({
      clerk_user_id: 'task-5-history-user',
    });
    const enrollment = await enrollmentRepository.save({
      user_id: user.id,
      deck_id: essentialDeck.id,
      is_active: true,
    });
    const progress = await progressRepository.save({
      user_id: user.id,
      card_id: replacedCard.id,
      stage: LearningStage.Review,
      due_at: new Date('2026-07-15T00:00:00.000Z'),
      stability: 3,
      difficulty: 5,
      elapsed_days: 2,
      scheduled_days: 4,
      repetitions: 3,
      lapses: 1,
      last_reviewed_at: new Date('2026-07-14T00:00:00.000Z'),
      last_rating: ReviewRating.Good,
      scheduler_version: 'test@1',
    });
    const review = await reviewRepository.save({
      user_id: user.id,
      card_id: replacedCard.id,
      client_request_id: randomUUID(),
      rating: ReviewRating.Good,
      reviewed_at: new Date('2026-07-14T00:00:00.000Z'),
      client_reviewed_at: new Date('2026-07-14T00:00:00.000Z'),
      scheduler_version: 'test@1',
      state_before: { stage: LearningStage.Learning },
      state_after: { stage: LearningStage.Review },
    });
    const foreignDeck = await deckRepository.save({
      slug: 'admin-curated-deck',
      name: 'Admin Curated Deck',
      description: 'Not managed by the starter seed.',
      type: DeckType.Tip,
      level: 'advanced',
      content_version: 'admin@1',
      sort_order: 999,
      is_published: true,
    });

    const summary = await seedLearningContent(
      dataSource,
      createUpdatedBundle(originalBundle),
    );

    expect(summary).toEqual({
      contentVersion: 'starter@2026.07.2',
      decksUpserted: 5,
      cardsUpserted: 128,
      decksUnpublished: 1,
      cardsDeactivated: 21,
    });

    const updatedExistingCard = await cardRepository.findOneByOrFail({
      deck_id: essentialDeck.id,
      content_key: UPDATED_CARD_KEY,
    });
    expect(updatedExistingCard).toMatchObject({
      answer: UPDATED_ANSWER,
      content_version: 'starter@2026.07.2',
      is_active: true,
    });

    const retiredCard = await cardRepository.findOneByOrFail({
      deck_id: essentialDeck.id,
      content_key: REPLACED_CARD_KEY,
    });
    expect(retiredCard).toMatchObject({
      id: replacedCard.id,
      content_version: 'starter@2026.07.2',
      is_active: false,
    });
    expect(
      await cardRepository.findOneByOrFail({
        deck_id: essentialDeck.id,
        content_key: NEW_CARD_KEY,
      }),
    ).toMatchObject({
      content_version: 'starter@2026.07.2',
      is_active: true,
    });
    expect(
      await cardRepository.countBy({
        deck_id: essentialDeck.id,
        is_active: true,
      }),
    ).toBe(20);
    expect(await cardRepository.countBy({ deck_id: essentialDeck.id })).toBe(
      21,
    );

    expect(
      await deckRepository.findOneByOrFail({ id: omittedDeck.id }),
    ).toMatchObject({
      slug: OMITTED_DECK_SLUG,
      content_version: 'starter@2026.07.2',
      is_published: false,
    });
    expect(
      await cardRepository.countBy({
        deck_id: omittedDeck.id,
        is_active: true,
      }),
    ).toBe(0);
    expect(await cardRepository.countBy({ deck_id: omittedDeck.id })).toBe(20);

    expect(
      await enrollmentRepository.findOneByOrFail({ id: enrollment.id }),
    ).toMatchObject({ user_id: user.id, deck_id: essentialDeck.id });
    expect(
      await progressRepository.findOneByOrFail({ id: progress.id }),
    ).toMatchObject({ user_id: user.id, card_id: replacedCard.id });
    expect(
      await reviewRepository.findOneByOrFail({ id: review.id }),
    ).toMatchObject({ user_id: user.id, card_id: replacedCard.id });

    expect(
      await deckRepository.findOneByOrFail({ id: foreignDeck.id }),
    ).toMatchObject({
      slug: 'admin-curated-deck',
      name: 'Admin Curated Deck',
      content_version: 'admin@1',
      sort_order: 999,
      is_published: true,
    });
  });

  it('rejects invalid content before connecting or mutating the database', async () => {
    await seedLearningContent(dataSource, loadLearningContent());
    const countsBefore = await captureLearningCounts(dataSource);
    const invalidContentDirectory = mkdtempSync(
      path.join(tmpdir(), 'gramio-invalid-learning-content-'),
    );
    writeInvalidCompleteBundle(invalidContentDirectory);
    const invalidInputDataSource = createTestDataSource();
    const initialize = jest.spyOn(invalidInputDataSource, 'initialize');

    try {
      await expect(
        seedLearningContentDatabase({
          load: () => loadLearningContent(invalidContentDirectory),
          dataSource: invalidInputDataSource,
          seed: seedLearningContent,
        }),
      ).rejects.toThrow(/deckDocuments\[0\].*answer/);
      expect(initialize).not.toHaveBeenCalled();

      const verificationDataSource = createTestDataSource();
      await verificationDataSource.initialize();
      try {
        await expect(
          captureLearningCounts(verificationDataSource),
        ).resolves.toEqual(countsBefore);
      } finally {
        await verificationDataSource.destroy();
      }
    } finally {
      initialize.mockRestore();
      rmSync(invalidContentDirectory, { recursive: true, force: true });
    }
  });
});
