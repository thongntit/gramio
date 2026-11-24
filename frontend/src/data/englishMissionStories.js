const grammarFallback = 'past-simple-vs-past-continuous';

const missingParcel = {
  id: 'missing-parcel',
  title: 'The Missing Parcel',
  description: 'Follow a parcel’s trail through the building and decide what the clues actually prove.',
  rounds: [
    {
      id: 'parcel-001',
      kind: 'choice',
      prompt: 'The parcel is not here. What does Ada tell the desk clerk?',
      context: 'At 9:10, Ada checks the west stairwell, where the tracking note said the box was left.',
      choices: [
        { id: 'parcel-001-a', text: '“I haven’t found the parcel yet.”' },
        { id: 'parcel-001-b', text: '“I found the parcel at 9:10.”' },
      ],
      answer: ['parcel-001-a'],
      explanation: 'The present perfect reports the result of Ada’s search up to now. She is still looking for the parcel.',
      rematchKey: 'past-simple-vs-present-perfect',
    },
    {
      id: 'parcel-002',
      kind: 'choice',
      prompt: 'Which note gives the clearest time of the courier’s message?',
      context: 'Ada opens the building chat to check the morning timeline.',
      choices: [
        { id: 'parcel-002-a', text: '“At 8:40, the courier texted that the parcel was by the west stairs.”' },
        { id: 'parcel-002-b', text: '“At 8:40, the courier was texting that the parcel had been by the west stairs.”' },
      ],
      answer: ['parcel-002-a'],
      explanation: 'A completed message at a stated time takes the past simple: “texted.”',
      rematchKey: grammarFallback,
    },
    {
      id: 'parcel-003',
      kind: 'order',
      prompt: 'Put the confirmed events in the order they happened.',
      context: 'Three independent records establish the parcel’s morning route.',
      choices: [
        { id: 'parcel-003-c', text: 'At 8:50, Jo moved unattended boxes into the parcel room.' },
        { id: 'parcel-003-a', text: 'At 8:40, the courier reported leaving the box by the west stairs.' },
        { id: 'parcel-003-d', text: 'At 9:10, Ada found the stairwell empty.' },
        { id: 'parcel-003-b', text: 'At 8:46, Omar saw a box beside the west stairs.' },
      ],
      answer: ['parcel-003-a', 'parcel-003-b', 'parcel-003-c', 'parcel-003-d'],
      explanation: 'The message came first, Omar saw the box six minutes later, Jo moved unattended boxes next, and Ada checked last.',
      rematchKey: grammarFallback,
    },
    {
      id: 'parcel-004',
      kind: 'choice',
      prompt: 'Omar describes what he saw at 8:46. Which sentence fits?',
      context: 'Omar is certain about the box, but he did not see who delivered it.',
      choices: [
        { id: 'parcel-004-a', text: '“I was walking upstairs when I noticed the box.”' },
        { id: 'parcel-004-b', text: '“I walked upstairs when I was noticing the box.”' },
      ],
      answer: ['parcel-004-a'],
      explanation: 'The longer action was in progress (“was walking”) when the brief event (“noticed”) happened.',
      rematchKey: grammarFallback,
    },
    {
      id: 'parcel-005',
      kind: 'choice',
      prompt: 'The parcel room search finds a box with Ada’s name. What is the fairest conclusion?',
      context: 'Jo confirms she moved boxes from the stairs at 8:50. The parcel is found under a bench in the parcel room.',
      choices: [
        { id: 'parcel-005-a', text: 'Jo stole the parcel and hid it.' },
        { id: 'parcel-005-b', text: 'The parcel was moved to the parcel room; the clues do not show that anyone stole it.' },
        { id: 'parcel-005-c', text: 'Omar delivered the parcel late.' },
      ],
      answer: ['parcel-005-b'],
      explanation: 'The timeline and Jo’s account explain why the box was no longer by the stairs. Nothing in the clues supports an accusation of theft.',
      rematchKey: grammarFallback,
    },
  ],
};

const inboxRescue = {
  id: 'inbox-rescue',
  title: 'Inbox Rescue',
  description: 'Choose a reply that fits the moment, then see how the conversation could continue.',
  roundLimit: 5,
  rounds: [
    {
      id: 'inbox-001', kind: 'choice', rematchKey: 'future-intent',
      prompt: 'Your classmate asks if you can review their draft tonight. What do you say?',
      context: 'You have time after dinner and want to make a clear promise.',
      choices: [
        { id: 'inbox-001-a', text: '“I’ll read it after dinner and send you notes.”' },
        { id: 'inbox-001-b', text: '“I’m reading it after dinner yesterday.”' },
        { id: 'inbox-001-c', text: '“I read it after dinner tomorrow.”' },
      ],
      answer: ['inbox-001-a'],
      explanation: '“I’ll read” makes a clear future promise.',
      outcomes: {
        'inbox-001-a': 'They send the draft, and you both know when to expect your notes.',
        'inbox-001-b': 'Your classmate is unsure whether you mean tonight or a past evening.',
        'inbox-001-c': 'They ask you to clarify because the past verb conflicts with “tomorrow.”',
      },
    },
    {
      id: 'inbox-002', kind: 'choice', rematchKey: 'past-sequence',
      prompt: 'A teammate asks why you missed the call. Which reply explains it clearly?',
      context: 'The call began at 3:00. Your train stopped just before then.',
      choices: [
        { id: 'inbox-002-a', text: '“My train stopped, so I couldn’t join.”' },
        { id: 'inbox-002-b', text: '“My train was stopping, so I couldn’t join.”' },
      ],
      answer: ['inbox-002-a'],
      explanation: 'The train stopping is a completed event that explains the missed call.',
      outcomes: {
        'inbox-002-a': 'Your teammate understands what happened and shares the call notes.',
        'inbox-002-b': 'Your teammate wonders whether the train stopped once or kept stopping repeatedly.',
      },
    },
    {
      id: 'inbox-003', kind: 'choice', rematchKey: 'future-intent',
      prompt: 'A friend asks if you have a plan for Saturday. You already bought a ticket. Reply:',
      context: 'You are meeting at the station at noon.',
      choices: [
        { id: 'inbox-003-a', text: '“I’m going to the art fair; I’ve bought my ticket.”' },
        { id: 'inbox-003-b', text: '“I went to the art fair next Saturday.”' },
      ],
      answer: ['inbox-003-a'],
      explanation: '“I’m going to” describes an intention already supported by a plan.',
      outcomes: {
        'inbox-003-a': 'Your friend asks what time to meet at the station.',
        'inbox-003-b': 'Your friend thinks the fair already happened and asks which Saturday you mean.',
      },
    },
    {
      id: 'inbox-004', kind: 'choice', rematchKey: 'past-sequence',
      prompt: 'Your neighbor asks about the loud noise last night. What do you write?',
      context: 'You heard a crash while you were washing dishes; a recycling bin had fallen over.',
      choices: [
        { id: 'inbox-004-a', text: '“I was washing dishes when the bin fell over.”' },
        { id: 'inbox-004-b', text: '“I washed dishes when the bin was falling over.”' },
      ],
      answer: ['inbox-004-a'],
      explanation: 'The washing was in progress when the bin fell, a shorter event.',
      outcomes: {
        'inbox-004-a': 'Your neighbor checks the bin and thanks you for explaining.',
        'inbox-004-b': 'Your neighbor is unsure which event was happening first.',
      },
    },
    {
      id: 'inbox-005', kind: 'choice', rematchKey: 'present-simple-vs-present-continuous',
      prompt: 'A coworker asks why you are not answering the shared chat. Reply:',
      context: 'You are presenting to a client right now.',
      choices: [
        { id: 'inbox-005-a', text: '“I’m presenting right now. I’ll reply when we finish.”' },
        { id: 'inbox-005-b', text: '“I present right now. I replied when we finish.”' },
      ],
      answer: ['inbox-005-a'],
      explanation: 'The present continuous describes the activity happening now; “I’ll reply” refers to later.',
      outcomes: {
        'inbox-005-a': 'Your coworker waits until the meeting is over.',
        'inbox-005-b': 'Your coworker cannot tell whether the presentation is happening now or usually.',
      },
    },
    {
      id: 'inbox-006', kind: 'choice', rematchKey: 'past-simple-vs-present-perfect',
      prompt: 'A friend asks whether you have ever tried the new bakery. Reply:',
      context: 'You visited it last weekend, and the question is about your experience so far.',
      choices: [
        { id: 'inbox-006-a', text: '“Yes, I’ve tried it. I went last weekend.”' },
        { id: 'inbox-006-b', text: '“Yes, I try it last weekend.”' },
      ],
      answer: ['inbox-006-a'],
      explanation: 'The present perfect answers the experience question; the past simple gives the finished time.',
      outcomes: {
        'inbox-006-a': 'Your friend asks what you recommend ordering.',
        'inbox-006-b': 'Your friend understands, but the tense and past time phrase do not fit together.',
      },
    },
    {
      id: 'inbox-007', kind: 'choice', rematchKey: 'past-sequence',
      prompt: 'A project partner asks what happened to the printed charts. Reply:',
      context: 'You left them on the desk before lunch, then the cleaner moved them to a tray.',
      choices: [
        { id: 'inbox-007-a', text: '“I left them on the desk, and the cleaner moved them to the tray.”' },
        { id: 'inbox-007-b', text: '“I was leaving them on the desk, and the cleaner was moving them to the tray.”' },
      ],
      answer: ['inbox-007-a'],
      explanation: 'Both actions are completed events in the sequence, so the past simple is clear.',
      outcomes: {
        'inbox-007-a': 'Your partner finds the charts in the tray and continues the presentation prep.',
        'inbox-007-b': 'Your partner thinks the actions may still be in progress and checks the office.',
      },
    },
    {
      id: 'inbox-008', kind: 'choice', rematchKey: 'future-intent',
      prompt: 'Your study group asks what you plan to do before Friday’s quiz. Reply:',
      context: 'You have already chosen the chapters and blocked two evenings.',
      choices: [
        { id: 'inbox-008-a', text: '“I’m going to review chapters four and five tonight.”' },
        { id: 'inbox-008-b', text: '“I reviewed chapters four and five tomorrow.”' },
      ],
      answer: ['inbox-008-a'],
      explanation: '“I’m going to review” expresses a decided plan.',
      outcomes: {
        'inbox-008-a': 'The group asks if you can share your chapter notes.',
        'inbox-008-b': 'The group is confused by the past tense with “tomorrow.”',
      },
    },
    {
      id: 'inbox-009', kind: 'choice', rematchKey: 'past-simple-vs-present-perfect',
      prompt: 'A friend asks if you have sent the photos yet. You sent them ten minutes ago. Reply:',
      context: 'The message is about whether the photos are available now.',
      choices: [
        { id: 'inbox-009-a', text: '“I’ve sent them; you should see them now.”' },
        { id: 'inbox-009-b', text: '“I send them ten minutes ago; you should see them now.”' },
      ],
      answer: ['inbox-009-a'],
      explanation: '“I’ve sent them” connects the completed action to the present result.',
      outcomes: {
        'inbox-009-a': 'Your friend checks the chat and confirms the photos arrived.',
        'inbox-009-b': 'Your friend understands but notices the verb does not match “ten minutes ago.”',
      },
    },
    {
      id: 'inbox-010', kind: 'choice', rematchKey: 'past-sequence',
      prompt: 'Your manager asks why the room was ready late. Reply:',
      context: 'The projector stopped working during setup, so you restarted it.',
      choices: [
        { id: 'inbox-010-a', text: '“The projector stopped while I was setting up the room.”' },
        { id: 'inbox-010-b', text: '“The projector was stopping while I set up the room.”' },
      ],
      answer: ['inbox-010-a'],
      explanation: 'The projector stopped during the longer setup activity.',
      outcomes: {
        'inbox-010-a': 'Your manager understands the delay and asks whether the projector works now.',
        'inbox-010-b': 'Your manager is unsure whether the projector failed once or repeatedly.',
      },
    },
  ],
};

const sameScene = {
  id: 'same-scene',
  title: 'Same Scene, Three Stories',
  description: 'Read three accounts of one event in each episode: an eyewitness, a later reporter, and a prediction.',
  rounds: [
    {
      id: 'scene-001', kind: 'choice', rematchKey: 'past-simple-vs-past-continuous',
      prompt: 'Eyewitness, 4:05 p.m.: Which line describes the moment the lights went out?',
      context: 'Episode 1 — The community hall. Leena was on stage when the power failed.',
      choices: [
        { id: 'scene-001-a', text: '“I was introducing the band when the lights went out.”' },
        { id: 'scene-001-b', text: '“I introduced the band when the lights were going out.”' },
      ],
      answer: ['scene-001-a'],
      explanation: 'The introduction was in progress when the brief power cut occurred.',
    },
    {
      id: 'scene-002', kind: 'choice', rematchKey: 'past-sequence',
      prompt: 'Later reporter: Which sentence reports the confirmed sequence?',
      context: 'Episode 1 — Later that evening, the hall manager reviews the event log.',
      choices: [
        { id: 'scene-002-a', text: '“The lights failed, and the backup lamps came on a few seconds later.”' },
        { id: 'scene-002-b', text: '“The lights were failing, and the backup lamps were coming on a few seconds later.”' },
      ],
      answer: ['scene-002-a'],
      explanation: 'The log records two completed events in sequence.',
    },
    {
      id: 'scene-003', kind: 'choice', rematchKey: 'future-intent',
      prompt: 'Prediction: What does the organizer say about the next show?',
      context: 'Episode 1 — The wiring has been repaired, and a technician has booked an inspection.',
      choices: [
        { id: 'scene-003-a', text: '“We’re going to test the lights before the next show.”' },
        { id: 'scene-003-b', text: '“We tested the lights before the next show yesterday.”' },
      ],
      answer: ['scene-003-a'],
      explanation: 'The inspection is planned for a future show, so “we’re going to test” fits.',
    },
    {
      id: 'scene-004', kind: 'choice', rematchKey: 'past-simple-vs-past-continuous',
      prompt: 'Eyewitness, 10:20 a.m.: What did the cyclist see at the market?',
      context: 'Episode 2 — The Saturday market. A fruit cart rolled across the lane as Niko was carrying a sign.',
      choices: [
        { id: 'scene-004-a', text: '“I was carrying the sign when the cart rolled past me.”' },
        { id: 'scene-004-b', text: '“I carried the sign when the cart was rolling past me.”' },
      ],
      answer: ['scene-004-a'],
      explanation: 'Carrying the sign was underway when the cart rolled past.',
    },
    {
      id: 'scene-005', kind: 'choice', rematchKey: 'past-simple-vs-present-perfect',
      prompt: 'Later reporter: The stall owner is asked about the cart. Which reply fits?',
      context: 'Episode 2 — By noon, the cart has been returned to its stall; the owner mentions the completed incident.',
      choices: [
        { id: 'scene-005-a', text: '“It rolled away at 10:20, but we brought it back.”' },
        { id: 'scene-005-b', text: '“It has rolled away at 10:20, but we brought it back.”' },
      ],
      answer: ['scene-005-a'],
      explanation: 'A finished event with a specific past time (“at 10:20”) takes the past simple.',
    },
    {
      id: 'scene-006', kind: 'choice', rematchKey: 'future-intent',
      prompt: 'Prediction: What will the market coordinator do next week?',
      context: 'Episode 2 — The coordinator has ordered wheel locks after the cart incident.',
      choices: [
        { id: 'scene-006-a', text: '“We’re going to secure every cart before opening.”' },
        { id: 'scene-006-b', text: '“We secured every cart before opening last week.”' },
      ],
      answer: ['scene-006-a'],
      explanation: 'The new safety step is planned for next week.',
    },
    {
      id: 'scene-007', kind: 'choice', rematchKey: 'past-simple-vs-past-continuous',
      prompt: 'Eyewitness, 6:30 p.m.: What was happening when the fountain stopped?',
      context: 'Episode 3 — Riverside square. Mei was sketching nearby when the fountain suddenly went quiet.',
      choices: [
        { id: 'scene-007-a', text: '“I was sketching the fountain when it stopped.”' },
        { id: 'scene-007-b', text: '“I sketched the fountain when it was stopping.”' },
      ],
      answer: ['scene-007-a'],
      explanation: 'Sketching was in progress when the fountain stopped.',
    },
    {
      id: 'scene-008', kind: 'choice', rematchKey: 'past-simple-vs-present-perfect',
      prompt: 'Later reporter: The maintenance worker gives an update. Which is natural?',
      context: 'Episode 3 — An hour later, the fountain is running again and the worker describes the repair.',
      choices: [
        { id: 'scene-008-a', text: '“We’ve fixed the pump, so the fountain is running again.”' },
        { id: 'scene-008-b', text: '“We fixed the pump an hour ago, so the fountain has run again.”' },
      ],
      answer: ['scene-008-a'],
      explanation: 'The present perfect highlights the repair’s result now: the fountain is running again.',
    },
    {
      id: 'scene-009', kind: 'choice', rematchKey: 'future-intent',
      prompt: 'Prediction: What does the square manager expect for tomorrow?',
      context: 'Episode 3 — The worker has replaced the pump, and the manager expects the fountain to stay on.',
      choices: [
        { id: 'scene-009-a', text: '“The fountain should run all day tomorrow.”' },
        { id: 'scene-009-b', text: '“The fountain ran all day tomorrow.”' },
      ],
      answer: ['scene-009-a'],
      explanation: '“Should run” expresses an expectation about tomorrow.',
    },
  ],
};

export default [missingParcel, inboxRescue, sameScene];
