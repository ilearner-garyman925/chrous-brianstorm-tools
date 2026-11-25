export type RoundStatus = "open" | "locked";
export type AnalysisSource = "llm" | "local";

export type Concept = {
  responseIds?: string[];
  supporterCount?: number;
  text: string;
  weight: number;
  themeId: string | null;
};

export type Theme = {
  id: string;
  label: string;
  summary: string;
  keywords: string[];
  responseIds: string[];
};

export type Tension = {
  id: string;
  label: string;
  summary: string;
  leftLabel: string;
  rightLabel: string;
  placements: { responseId: string; position: number }[];
};

export type Analysis = {
  id: string;
  roundId: string;
  createdAt: number;
  source: AnalysisSource;
  model: string | null;
  warning: string | null;
  overview: string;
  themes: Theme[];
  tensions: Tension[];
  followUps: string[];
  concepts: Concept[];
  responseCount: number;
};

export type GroupDraft = Omit<
  Analysis,
  "id" | "roundId" | "createdAt" | "source" | "model" | "warning"
>;

export type RoundView = {
  id: string;
  index: number;
  prompt: string;
  status: RoundStatus;
  createdAt: number;
  concepts: Concept[];
  freshCount: number;
};

export type HostResponse = {
  id: string;
  roundId: string;
  text: string;
  hidden: boolean;
  createdAt: number;
  participant: { id: string; label: string; sharedName: boolean };
};

export type HostSnapshot = {
  room: {
    code: string;
    title: string;
    createdAt: number;
    isDemo: boolean;
    showCloudToStudents: boolean;
    maxPerPerson: number;
    askForNames: boolean;
  };
  rounds: RoundView[];
  activeRoundId: string;
  responses: HostResponse[];
  analyses: Analysis[];
  llm: { configured: boolean; model: string | null };
  replay: { running: boolean; cursor: number; total: number } | null;
};

export type StudentSnapshot = {
  room: {
    code: string;
    title: string;
    askForNames: boolean;
    maxPerPerson: number;
    showCloudToStudents: boolean;
  };
  round: {
    id: string;
    index: number;
    prompt: string;
    status: RoundStatus;
  } | null;
  joined: boolean;
  me: { id: string; label: string; sharedName: boolean } | null;
  myResponses: {
    id: string;
    roundId: string;
    roundIndex: number;
    prompt: string;
    text: string;
  }[];
  responseCount: number;
  concepts: Concept[] | null;
  legend: { id: string; label: string }[] | null;
};

export type CreateRoomInput = {
  title: string;
  prompt: string;
  showCloudToStudents: boolean;
  askForNames: boolean;
  maxPerPerson: number;
};
