export const SAMPLE_TITLE = "How we use AI here";

export const SAMPLE_PROMPT =
  "What should we change about how we use AI tools in this class?";

export type SampleFacet =
  | "feedback"
  | "literacy"
  | "access"
  | "voice"
  | "brainstorm"
  | "dependency"
  | "aside";

export type SampleLine = {
  who: string;
  name: string | null;
  text: string;
  /** Ground truth for tests. The grouper must not read this field. */
  facet: SampleFacet;
};

export const SAMPLE_LINES: SampleLine[] = [
  {
    who: "jonah",
    name: "Jonah Adeyemi",
    facet: "feedback",
    text: "Let us use it for feedback on a draft, but the piece we hand in has to be our rewrite. I want comments on my version, not a finished answer I didn't earn.",
  },
  {
    who: "elena",
    name: "Elena Voss",
    facet: "feedback",
    text: "Don't ban it. The useful part is feedback on a draft. What should change is submitting a final answer we didn't rewrite.",
  },
  {
    who: "theo",
    name: "Theo Park",
    facet: "feedback",
    text: "Let us use it on a draft, then the grade is on our rewrite. Show the draft history if you're worried about cheating.",
  },
  {
    who: "unnamed-a",
    name: null,
    facet: "feedback",
    text: "Draft feedback only.",
  },
  {
    who: "jonah",
    name: "Jonah Adeyemi",
    facet: "feedback",
    text: "If feedback on a draft is allowed, say so on the assignment. Right now people hide the draft because it feels like a trap.",
  },
  {
    who: "maya",
    name: "Maya Chen",
    facet: "literacy",
    text: "Teach us how to prompt and how to check a source. I can't tell when a citation is invented. A critique checklist would change more than another warning.",
  },
  {
    who: "maya",
    name: "Maya Chen",
    facet: "literacy",
    text: "We should practice checking a wrong claim and saying why. Prompting the model to argue back is a skill, and so is spotting a fake source.",
  },
  {
    who: "unnamed-b",
    name: null,
    facet: "literacy",
    text: "Teach us to check sources.",
  },
  {
    who: "lena",
    name: "Lena Cho",
    facet: "literacy",
    text: "Give us a good prompt and a lazy prompt for the same task, then make us check which facts survive.",
  },
  {
    who: "lena",
    name: "Lena Cho",
    facet: "literacy",
    text: "I want us to ask for the counterargument, then check the sources ourselves before we trust a citation.",
  },
  {
    who: "priya",
    name: "Priya Shah",
    facet: "access",
    text: "People with a paid subscription get a better model. That is an access problem. We should only expect tools everyone can open.",
  },
  {
    who: "imani",
    name: "Imani Brooks",
    facet: "access",
    text: "I don't have a quiet hour at home and can't afford another subscription. If this is required, I need time during the seminar, not a paid account.",
  },
  {
    who: "unnamed-c",
    name: null,
    facet: "access",
    text: "Stop requiring paid tools.",
  },
  {
    who: "priya",
    name: "Priya Shah",
    facet: "access",
    text: "If we use it, the school should provide access. Otherwise only some of us can afford to take part.",
  },
  {
    who: "farah",
    name: "Farah Nasser",
    facet: "access",
    text: "The free model is weaker in the language I write in. A paid plan should not be the price of keeping up.",
  },
  {
    who: "luis",
    name: "Luis Ortega",
    facet: "voice",
    text: "It flattens my voice. I sound generic, like a brochure. I want to keep a sentence that is mine even if the wording is clumsy.",
  },
  {
    who: "unnamed-d",
    name: null,
    facet: "voice",
    text: "Keep our own voice.",
  },
  {
    who: "luis",
    name: "Luis Ortega",
    facet: "voice",
    text: "Don't smooth every line. The odd wording is sometimes the idea. I'm scared my voice gets edited out.",
  },
  {
    who: "grace",
    name: "Grace Ito",
    facet: "voice",
    text: "I can tell when something was fully generated. It has no point of view and the voice is generic.",
  },
  {
    who: "grace",
    name: "Grace Ito",
    facet: "voice",
    text: "Let us challenge the structure, not replace the wording. My wording is the part I trust, and the voice should stay mine.",
  },
  {
    who: "hannah",
    name: "Hannah Berg",
    facet: "brainstorm",
    text: "The useful moment is the blank page. Let us brainstorm three angles when we're stuck, then close it and choose.",
  },
  {
    who: "unnamed-e",
    name: null,
    facet: "brainstorm",
    text: "Brainstorm, then close it.",
  },
  {
    who: "hannah",
    name: "Hannah Berg",
    facet: "brainstorm",
    text: "Use it when you're stuck, not to skip the reading. Brainstorming is different from a finished essay.",
  },
  {
    who: "felix",
    name: "Felix Rahman",
    facet: "brainstorm",
    text: "A starter outline when I'm stuck gets me moving. Then I close the brainstorm and write.",
  },
  {
    who: "felix",
    name: "Felix Rahman",
    facet: "brainstorm",
    text: "I like brainstorming options I can reject. The options are the point, especially when the page is blank and I'm stuck.",
  },
  {
    who: "samir",
    name: "Samir Haddad",
    facet: "dependency",
    text: "I'm getting dependent, and the habit is the problem. Some work should happen with the laptop shut.",
  },
  {
    who: "naomi",
    name: "Naomi Wright",
    facet: "dependency",
    text: "There is also the energy cost of the habit. A huge query for a one-line definition should happen less often.",
  },
  {
    who: "samir",
    name: "Samir Haddad",
    facet: "dependency",
    text: "Relying on it for every sentence is the habit I'd change. Save it for the difficult step, then write the rest ourselves.",
  },
  {
    who: "unnamed-f",
    name: null,
    facet: "dependency",
    text: "Laptop shut sometimes.",
  },
  {
    who: "naomi",
    name: "Naomi Wright",
    facet: "dependency",
    text: "A no-AI stretch each week would show me I can still start. Right now I reach for it out of habit.",
  },
  {
    who: "chris",
    name: "Chris Daley",
    facet: "aside",
    text: "The projector in this room is still fuzzy, and the board is hard to make out from my seat.",
  },
  {
    who: "ruth",
    name: "Ruth Mendel",
    facet: "aside",
    text: "I mostly want longer office hours. I need a person to tell me if the argument holds.",
  },
];
