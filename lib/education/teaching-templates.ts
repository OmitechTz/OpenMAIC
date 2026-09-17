import type { EducationBrief } from './artifacts';

export interface TeachingTemplate {
  id: string;
  code: string;
  programme: string;
  year: string;
  title: string;
  description: string;
  units: string[];
  objectives: string[];
  software: string[];
  activity: string;
  assessment: string;
  teachingNotes: string;
  topic: string;
  presentationInstruction: string;
}

export const TEACHING_TEMPLATES: TeachingTemplate[] = [
  {
    id: 'artificial-intelligence',
    code: 'MEU 07571',
    programme: 'BMTE',
    year: 'Year 3',
    title: 'Artificial Intelligence',
    description: 'Understand AI, test simple models and evaluate their limitations.',
    units: [
      'AI foundations and responsible use',
      'Data quality and preparation',
      'Supervised learning and evaluation',
      'Unsupervised learning and patterns',
      'Generative AI, prompting and verification',
      'Applied project and human review',
    ],
    objectives: [
      'Distinguish a rule-based system from a learned model using an example.',
      'Separate training and test data and explain why leakage gives misleading results.',
      'Calculate accuracy from a small confusion matrix and identify one limitation.',
      'Identify a bias or privacy risk and propose a human review step.',
    ],
    software: ['Python', 'JupyterLab', 'pandas', 'scikit-learn'],
    topic:
      'Introduction to Artificial Intelligence: classify machine condition from a small synthetic dataset',
    activity:
      'Teams classify twelve synthetic machine-condition records using a transparent rule, then compare against supplied predictions from a simple model. Reserve test records before designing the rule. Discuss errors and whether accuracy alone is sufficient.',
    assessment:
      'Include a rule-versus-model question, a train/test leakage scenario, a small confusion-matrix calculation, and an explanation of a false-negative consequence. Finish with an exit ticket on when a human must review an AI result.',
    teachingNotes:
      'Use synthetic data only. No student personal data or external accounts are required. Provide a paper-table version and an optional local notebook extension. Mark model outputs as supplied examples, never as results of code that was not run.',
    presentationInstruction:
      'Build a complete semester lecture deck with a title slide, learning objectives, clear concept slides, diagrams, a small worked dataset example, annotated Python or notebook examples, model-evaluation visuals, limitations, a recap, discussion prompts, and an end-of-lecture knowledge check. Include useful speaker notes for every teaching slide.',
  },
  {
    id: 'industrial-automation',
    code: 'MEU 07569',
    programme: 'BMTE',
    year: 'Year 3',
    title: 'Industrial Automation',
    description: 'Model sensors, control logic and fault responses using safe simulations.',
    units: [
      'Automation architecture and process diagrams',
      'Sensors, actuators and signal types',
      'PLC inputs, outputs and scan cycle',
      'Sequences, timers and interlocks',
      'HMI, alarms and industrial communications',
      'Simulated commissioning and fault diagnosis',
    ],
    objectives: [
      'Map a simulated process to sensors, actuators and an input/output list.',
      'Trace a start/stop sequence across a PLC scan using a state table.',
      'Explain how a missing sensor signal changes the intended control sequence.',
      'Write acceptance tests for normal operation and simulated faults.',
    ],
    software: ['CODESYS', 'Factory I/O', 'PLC simulator'],
    topic: 'Industrial Automation: design and test a simulated conveyor control sequence',
    activity:
      'Create an I/O table and state diagram for a virtual conveyor. Trace start, stop and blocked-sensor cases on paper or in a simulator. Record expected versus observed states and explain each failed test.',
    assessment:
      'Include I/O classification, sequence tracing, a timer misconception, fault diagnosis and an acceptance-test plan. Assess explanations as well as final states.',
    teachingNotes:
      'Simulation only: do not connect generated logic to live machinery or industrial networks. Standard PLC logic is not a certified safety function. Any physical lab needs an instructor-approved risk assessment, equipment-specific procedure and qualified supervision; do not teach bypassing guards or interlocks.',
    presentationInstruction:
      'Build a complete semester lecture deck with a title slide, learning objectives, automation architecture, labelled sensor and actuator diagrams, PLC scan-cycle explanation, I/O tables, ladder-logic examples, sequence and interlock walkthroughs, simulator activities, fault cases, a recap, and an end-of-lecture knowledge check. Include useful speaker notes for every teaching slide.',
  },
  {
    id: 'engineering-maintenance',
    code: 'MEU 08130',
    programme: 'BMTE',
    year: 'Year 4',
    title: 'Engineering Maintenance',
    description: 'Plan maintenance and investigate faults using evidence and equipment guidance.',
    units: [
      'Maintenance strategies and work orders',
      'Hazard identification and approved isolation procedures',
      'Inspection, lubrication and manufacturer instructions',
      'Bearings, drives and alignment concepts',
      'Condition monitoring and fault diagnosis',
      'Root-cause analysis, records and maintenance planning',
    ],
    objectives: [
      'Compare corrective, preventive and condition-based maintenance for a sample asset.',
      'Distinguish a reported symptom from a supported fault hypothesis.',
      'Prioritize inspection evidence from a synthetic pump-maintenance case.',
      'Draft a work order with verification criteria, required authorization and maintenance records.',
    ],
    software: ['CMMS / openMAINT', 'Spreadsheet analysis', 'JupyterLab'],
    topic:
      'Engineering Maintenance: diagnose a simulated pump fault and prepare a maintenance work order',
    activity:
      'Use a synthetic pump history with vibration, temperature and inspection observations. Build a symptom/evidence/hypothesis table, identify missing information, and draft a planned work order with an explicit return-to-service review.',
    assessment:
      'Include strategy selection, an evidence-based diagnosis, a missing-information question and a work-order rubric. An unsafe intervention or invented equipment limit must require correction.',
    teachingNotes:
      'Use case data or isolated demonstration equipment only. Never invent torque, lubrication, alignment or vibration limits: require the exact manufacturer manual and teacher verification. Physical interventions require authorized personnel following site-specific isolation, stored-energy control and verification procedures; generated text does not authorize work.',
    presentationInstruction:
      'Build a complete semester lecture deck with a title slide, learning objectives, maintenance-strategy comparisons, asset and work-order examples, inspection and condition-monitoring visuals, worked MTBF and MTTR examples, fault-diagnosis cases, CMMS demonstrations, a recap, and an end-of-lecture knowledge check. Include useful speaker notes for every teaching slide.',
  },
  {
    id: 'fluid-mechanics',
    code: 'OGU 07538',
    programme: 'BOGE',
    year: 'Year 3',
    title: 'Fluid Mechanics',
    description:
      'Explain fluid behaviour, solve flow problems and compare calculations with simulation.',
    units: [
      'Fluid properties, pressure and hydrostatics',
      'Fluid kinematics and conservation of mass',
      'Bernoulli equation and energy applications',
      'Dimensional analysis and flow regimes',
      'Pipe flow, friction and minor losses',
      'Pumps, systems and introductory flow simulation',
    ],
    objectives: [
      'Calculate pressure and hydrostatic force using consistent SI units.',
      'Apply continuity and Bernoulli equations to a defined flow system.',
      'Determine a flow regime and explain the significance of Reynolds number.',
      'Compare analytical, experimental and simulated results and discuss discrepancies.',
    ],
    software: ['JupyterLab', 'Spreadsheet analysis', 'OpenFOAM', 'ParaView'],
    topic: 'Fluid Mechanics: analyse pressure, velocity and losses in a simple pipe-flow system',
    activity:
      'Calculate a pipe-flow case by hand and in a spreadsheet or notebook, then compare it with supplied experimental or simulated results. State assumptions, use consistent units and explain discrepancies.',
    assessment:
      'Include hydrostatics, continuity, Bernoulli application, Reynolds number, pipe losses, pump-system interpretation and a short comparison of analytical and simulated results.',
    teachingNotes:
      'Introduce simulation only after the governing principles and boundary conditions are understood. Require students to state assumptions, units and limitations. Generated CFD geometry, meshes and results require instructor review before use.',
    presentationInstruction:
      'Build a complete semester lecture deck with a title slide, learning objectives, clearly labelled fluid-system diagrams, equations with defined symbols and SI units, step-by-step worked examples, pressure and velocity plots, pipe-loss and pump-system examples, simulation interpretation, common mistakes, a recap, and an end-of-lecture knowledge check. Include useful speaker notes for every teaching slide.',
  },
];

export function teachingTemplateBrief(
  template: TeachingTemplate,
  output: 'lesson-pack' | 'syllabus',
): EducationBrief {
  return {
    mode: 'teacher',
    output,
    topic:
      output === 'syllabus' ? `${template.title}: introductory course outline` : template.topic,
    level: `${template.programme} ${template.year} undergraduate`,
    language: 'English',
    bilingual: true,
    differentiation: 'standard',
    minutes: 90,
    classSize: 30,
    questionCount: 8,
    examDate: '',
    sources: [],
    curriculum: `${template.code} · ${template.programme} ${template.year} · semester subject; align the weekly sequence to the approved institution syllabus`,
    objectives: [
      'Learning outcomes:',
      ...template.objectives.map((o) => `- ${o}`),
      `Suggested course sequence: ${template.units.join('; ')}.`,
      `Course software: ${template.software.join(', ')}.`,
      `Practical activity: ${template.activity}`,
      `Assessment evidence: ${template.assessment}`,
      `Teaching and safety requirements: ${template.teachingNotes}`,
      'Use local examples where appropriate, explain units and assumptions, and include an English/Kiswahili glossary. Provide supported and extension tasks. These are editable starting points, not an accredited syllabus.',
    ].join('\n'),
  };
}
