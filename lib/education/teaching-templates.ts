import type { EducationBrief } from './artifacts';

export interface TeachingTemplate {
  id: string;
  title: string;
  description: string;
  units: string[];
  objectives: string[];
  activity: string;
  assessment: string;
  teachingNotes: string;
  topic: string;
}

export const TEACHING_TEMPLATES: TeachingTemplate[] = [
  {
    id: 'artificial-intelligence',
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
    topic:
      'Introduction to Artificial Intelligence: classify machine condition from a small synthetic dataset',
    activity:
      'Teams classify twelve synthetic machine-condition records using a transparent rule, then compare against supplied predictions from a simple model. Reserve test records before designing the rule. Discuss errors and whether accuracy alone is sufficient.',
    assessment:
      'Include a rule-versus-model question, a train/test leakage scenario, a small confusion-matrix calculation, and an explanation of a false-negative consequence. Finish with an exit ticket on when a human must review an AI result.',
    teachingNotes:
      'Use synthetic data only. No student personal data or external accounts are required. Provide a paper-table version and an optional local notebook extension. Mark model outputs as supplied examples, never as results of code that was not run.',
  },
  {
    id: 'industrial-automation',
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
    topic: 'Industrial Automation: design and test a simulated conveyor control sequence',
    activity:
      'Create an I/O table and state diagram for a virtual conveyor. Trace start, stop and blocked-sensor cases on paper or in a simulator. Record expected versus observed states and explain each failed test.',
    assessment:
      'Include I/O classification, sequence tracing, a timer misconception, fault diagnosis and an acceptance-test plan. Assess explanations as well as final states.',
    teachingNotes:
      'Simulation only: do not connect generated logic to live machinery or industrial networks. Standard PLC logic is not a certified safety function. Any physical lab needs an instructor-approved risk assessment, equipment-specific procedure and qualified supervision; do not teach bypassing guards or interlocks.',
  },
  {
    id: 'machine-maintenance',
    title: 'Machine Maintenance',
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
    topic:
      'Machine Maintenance: diagnose a simulated pump fault and prepare a maintenance work order',
    activity:
      'Use a synthetic pump history with vibration, temperature and inspection observations. Build a symptom/evidence/hypothesis table, identify missing information, and draft a planned work order with an explicit return-to-service review.',
    assessment:
      'Include strategy selection, an evidence-based diagnosis, a missing-information question and a work-order rubric. An unsafe intervention or invented equipment limit must require correction.',
    teachingNotes:
      'Use case data or isolated demonstration equipment only. Never invent torque, lubrication, alignment or vibration limits: require the exact manufacturer manual and teacher verification. Physical interventions require authorized personnel following site-specific isolation, stored-energy control and verification procedures; generated text does not authorize work.',
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
    level: 'Introductory technical college / undergraduate — adapt to your class',
    language: 'English',
    bilingual: true,
    differentiation: 'standard',
    minutes: 90,
    classSize: 30,
    questionCount: 8,
    examDate: '',
    sources: [],
    curriculum: 'Teacher-adaptable draft; align to your institution syllabus',
    objectives: [
      'Learning outcomes:',
      ...template.objectives.map((o) => `- ${o}`),
      `Suggested course sequence: ${template.units.join('; ')}.`,
      `Practical activity: ${template.activity}`,
      `Assessment evidence: ${template.assessment}`,
      `Teaching and safety requirements: ${template.teachingNotes}`,
      'Use local examples where appropriate, explain units and assumptions, and include an English/Kiswahili glossary. Provide supported and extension tasks. These are editable starting points, not an accredited syllabus.',
    ].join('\n'),
  };
}
