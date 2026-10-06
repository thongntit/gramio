import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const combinedWorkflowPath = new URL(
  '../../.github/workflows/ci-backend.yml',
  import.meta.url,
);
const prWorkflowPath = new URL(
  '../../.github/workflows/ci-backend-pr.yml',
  import.meta.url,
);
const deployWorkflowPath = new URL(
  '../../.github/workflows/deploy-backend.yml',
  import.meta.url,
);
const frontendWorkflowPath = new URL(
  '../../.github/workflows/ci-frontend.yml',
  import.meta.url,
);
const readWorkflow = (path) =>
  existsSync(path) ? readFileSync(path, 'utf8') : '';
const prWorkflow = readWorkflow(prWorkflowPath);
const deployWorkflow = readWorkflow(deployWorkflowPath);
const frontendWorkflow = readWorkflow(frontendWorkflowPath);
const apiService = readFileSync(
  new URL('../src/services/openspeakApi.js', import.meta.url),
  'utf8',
);
const backendPackage = JSON.parse(
  readFileSync(new URL('../../backend/package.json', import.meta.url), 'utf8'),
);
const dataSource = readFileSync(
  new URL('../../backend/src/data-source.ts', import.meta.url),
  'utf8',
);
const migrationFiles = readdirSync(
  new URL('../../backend/src/database/migrations/', import.meta.url),
);

function extractYamlBlock(source, key, indentation) {
  const lines = source.split('\n');
  const prefix = ' '.repeat(indentation);
  const start = lines.findIndex((line) => line === `${prefix}${key}:`);
  assert.notEqual(start, -1, `Missing ${key} YAML block`);

  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() !== '' && line.match(/^ */)[0].length <= indentation) {
      break;
    }
    end += 1;
  }

  return lines.slice(start + 1, end).join('\n');
}

function parseNamedWorkflowSteps(stepsBlock) {
  const lines = stepsBlock.split('\n');
  const steps = [];

  for (let index = 0; index < lines.length; index += 1) {
    const nameMatch = lines[index].match(/^ {6}- name: (.+)$/);
    if (!nameMatch) {
      continue;
    }

    let end = index + 1;
    while (end < lines.length && !/^ {6}- /.test(lines[end])) {
      end += 1;
    }
    const stepLines = lines.slice(index + 1, end);
    const runIndex = stepLines.findIndex((line) => /^ {8}run: /.test(line));
    assert.notEqual(runIndex, -1, `Missing run command for ${nameMatch[1]}`);
    const runValue = stepLines[runIndex].slice('        run: '.length);
    const run =
      runValue === '|'
        ? stepLines
            .slice(runIndex + 1)
            .filter((line) => line.trim() !== '')
            .map((line) => {
              assert.match(line, /^ {10}\S/);
              return line.slice(10);
            })
            .join('\n')
        : runValue;

    steps.push({ name: nameMatch[1], run });
    index = end - 1;
  }

  return steps;
}

test('backend workflow has isolated branch deployment hooks', () => {
  assert.match(deployWorkflow, /COOLIFY_DEV_WEBHOOK_URL/);
  assert.match(deployWorkflow, /COOLIFY_PROD_WEBHOOK_URL/);
  assert.match(deployWorkflow, /github\.ref == 'refs\/heads\/dev'/);
  assert.match(deployWorkflow, /github\.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(deployWorkflow, /secrets\.COOLIFY_WEBHOOK_URL/);
});

test('both Coolify deployment hooks use POST and force a fresh image pull', () => {
  assert.match(
    deployWorkflow,
    /-X POST "\$\{\{ secrets\.COOLIFY_DEV_WEBHOOK_URL \}\}&force=true"/,
  );
  assert.match(
    deployWorkflow,
    /-X POST "\$\{\{ secrets\.COOLIFY_PROD_WEBHOOK_URL \}\}&force=true"/,
  );
  assert.doesNotMatch(deployWorkflow, /-X GET .*COOLIFY_.*WEBHOOK_URL/);
});

test('backend PR workflow contains validation only', () => {
  assert.equal(existsSync(combinedWorkflowPath), false);
  assert.equal(existsSync(prWorkflowPath), true);
  assert.match(prWorkflow, /pull_request:/);
  assert.doesNotMatch(prWorkflow, /\n {2}push:/);
  const jobsBlock = extractYamlBlock(prWorkflow, 'jobs', 0);
  const backendJob = extractYamlBlock(jobsBlock, 'backend', 2);
  const backendStepsBlock = extractYamlBlock(backendJob, 'steps', 4);
  const backendSteps = parseNamedWorkflowSteps(backendStepsBlock);
  const unitTestsIndex = backendSteps.findIndex(
    (step) => step.name === 'Unit tests',
  );

  assert.match(backendJob, /^ {10}POSTGRES_DB: openspeak_test$/m);
  assert.match(backendJob, /^ {6}ALLOW_DESTRUCTIVE_DB_TESTS: "true"$/m);
  assert.notEqual(unitTestsIndex, -1);
  assert.deepEqual(backendSteps.slice(unitTestsIndex), [
    { name: 'Unit tests', run: 'npm test -- --ci' },
    { name: 'Build production backend', run: 'npm run build' },
    {
      name: 'Rehearse production migrations on ephemeral CI database',
      run: 'npm run migration:run:prod',
    },
    {
      name: 'Rehearse learning content seed twice',
      run: 'npm run seed:learning:prod\nnpm run seed:learning:prod',
    },
    {
      name: 'Verify learning content integration',
      run: 'npm run test:e2e -- --runInBand learning-content-seed.e2e-spec.ts',
    },
    { name: 'E2E tests', run: 'npm run test:e2e -- --ci' },
  ]);
  assert.doesNotMatch(backendStepsBlock, /docker\/build-push-action/);
  assert.doesNotMatch(backendJob, /COOLIFY_/);
});

test('workflow step parser ignores other jobs and block scalar text', () => {
  const workflow = `jobs:
  decoy:
    steps:
      - name: Build production backend
        run: npm run build
  backend:
    steps:
      - name: Unit tests
        run: |
          name: Build production backend
          run: npm run build
      - name: E2E tests
        run: npm run test:e2e -- --ci
`;
  const jobsBlock = extractYamlBlock(workflow, 'jobs', 0);
  const backendJob = extractYamlBlock(jobsBlock, 'backend', 2);

  assert.deepEqual(
    parseNamedWorkflowSteps(extractYamlBlock(backendJob, 'steps', 4)),
    [
      {
        name: 'Unit tests',
        run: 'name: Build production backend\nrun: npm run build',
      },
      { name: 'E2E tests', run: 'npm run test:e2e -- --ci' },
    ],
  );
});

test('backend deploy workflow builds and deploys pushes only', () => {
  assert.equal(existsSync(deployWorkflowPath), true);
  assert.match(deployWorkflow, /push:/);
  assert.doesNotMatch(deployWorkflow, /pull_request:/);

  const publishJob = deployWorkflow.match(
    /publish-backend-image:[\s\S]*?(?=\n {2}deploy-dev:)/,
  )?.[0];
  assert.ok(publishJob);
  assert.match(publishJob, /docker\/build-push-action@v5/);
  assert.doesNotMatch(deployWorkflow, /POSTGRES_DB:/);
  assert.doesNotMatch(deployWorkflow, /ALLOW_DESTRUCTIVE_DB_TESTS/);
  assert.doesNotMatch(deployWorkflow, /npm run (lint|test|migration)/);
});

test('TypeORM migration directory contains migration files only', () => {
  assert.deepEqual(
    migrationFiles.filter((file) => file.endsWith('.spec.ts')),
    [],
  );
});

test('frontend API default points to production Gramio backend', () => {
  assert.match(apiService, /https:\/\/gramio-api\.thongnt\.dev\/api/);
  assert.doesNotMatch(apiService, /openspeak-api\.thongnt\.dev/);
});

test('frontend CI runs tests, lint, and build', () => {
  assert.match(frontendWorkflow, /run: bun run test/);
  assert.match(frontendWorkflow, /run: bun run lint/);
  assert.match(frontendWorkflow, /run: bun run build/);
});

test('production image exposes compiled migration and seed commands', () => {
  assert.equal(
    backendPackage.scripts['migration:run:prod'],
    'typeorm migration:run -d dist/data-source.js',
  );
  assert.equal(
    backendPackage.scripts['seed:prod'],
    'node dist/database/seeds/seed.js',
  );
  assert.match(dataSource, /__dirname/);
  assert.doesNotMatch(dataSource, /entities: \['src\//);
  assert.doesNotMatch(dataSource, /migrations: \['src\//);
});
