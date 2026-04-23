import type { ImageSourcePropType } from "react-native";

export type LibraryChapter = {
  body: string[];
  title: string;
};

export type LibraryBook = {
  accentColor: string;
  author: string;
  blurb: string;
  category: string;
  coverImage: ImageSourcePropType | null;
  estimatedMinutes: number;
  id: string;
  rewardLabel: string;
  shelfLabel: string;
  title: string;
  chapters: LibraryChapter[];
};

const BOOK_COVER_IMAGE = require("../assets/images/book_sample.png");

export const LIBRARY_BOOKS: LibraryBook[] = [
  {
    id: "breathing-room",
    title: "Breathing Room",
    author: "Bawat Tala Library",
    category: "Calming Read",
    estimatedMinutes: 6,
    rewardLabel: "5 stars",
    shelfLabel: "Featured shelf",
    accentColor: "#D7F0B7",
    coverImage: BOOK_COVER_IMAGE,
    blurb: "A short guide for slowing down when your thoughts start racing.",
    chapters: [
      {
        title: "Open the Door Gently",
        body: [
          "Not every difficult moment needs a perfect answer right away. Sometimes the first kind thing you can do is create a little space between yourself and the pressure you are feeling.",
          "Imagine opening a window in a crowded room. The room does not become silent at once, but the air begins to move. That is what a pause can do for the mind. It does not erase the hard feeling. It simply makes the feeling easier to stand beside.",
        ],
      },
      {
        title: "Breathe Like You Mean It",
        body: [
          "Try this: inhale slowly for four counts, hold for four, and exhale for six. Let your shoulders drop while you breathe out. Repeat that pattern until your body remembers that it is allowed to settle.",
          "Breathing is not a magic trick. It is a message to your nervous system. Each longer exhale tells your body that it can loosen its grip, even if only a little.",
        ],
      },
      {
        title: "Keep One Soft Thing",
        body: [
          "Before you leave this page, choose one soft thing to carry with you. It could be a slower breath, a glass of water, a stretch, or a sentence like: I can move through this one small step at a time.",
        ],
      },
    ],
  },
  {
    id: "small-wins-handbook",
    title: "Small Wins Handbook",
    author: "Bawat Tala Library",
    category: "Motivation",
    estimatedMinutes: 7,
    rewardLabel: "4 stars",
    shelfLabel: "Steady shelf",
    accentColor: "#CFE6F8",
    coverImage: BOOK_COVER_IMAGE,
    blurb: "A reminder that progress still counts when it looks quiet from the outside.",
    chapters: [
      {
        title: "What Counts as a Win",
        body: [
          "A win does not have to impress anyone to matter. Getting out of bed, answering one message, showing up to class, or choosing not to give up are all real forms of movement.",
          "When you are exhausted, your small actions may already be carrying more weight than people can see. That effort deserves to be named with honesty instead of dismissed.",
        ],
      },
      {
        title: "Shrink the Finish Line",
        body: [
          "If a task feels too big, make the goal smaller until it feels possible. Read one page. Clean one corner. Write one sentence. Small starts are often what make the next step reachable.",
          "Momentum usually arrives after action, not before it. You do not need to feel fully ready to begin.",
        ],
      },
      {
        title: "Record the Evidence",
        body: [
          "At the end of the day, write down three things you completed, even if they seem simple. Over time, that list becomes evidence that you are still building your life, one steady step at a time.",
        ],
      },
    ],
  },
  {
    id: "when-thoughts-get-loud",
    title: "When Thoughts Get Loud",
    author: "Bawat Tala Library",
    category: "Reflection",
    estimatedMinutes: 8,
    rewardLabel: "6 stars",
    shelfLabel: "Reflective shelf",
    accentColor: "#E8D7F2",
    coverImage: BOOK_COVER_IMAGE,
    blurb: "A grounding read for moments when your mind keeps looping in every direction.",
    chapters: [
      {
        title: "Name the Noise",
        body: [
          "When thoughts get loud, they often blur into one heavy cloud. Start by naming what is actually happening. Are you worried, ashamed, overwhelmed, or tired? Giving the feeling a name can make it less shapeless.",
          "You do not have to solve every thought immediately. You only need to notice which one is asking for your attention first.",
        ],
      },
      {
        title: "Come Back to the Room",
        body: [
          "Look for five things you can see, four things you can feel, three things you can hear, two things you can smell, and one thing you can taste. This brings your mind out of the spiral and back into the present.",
          "Grounding does not make pain disappear, but it helps you stand on solid ground while you face it.",
        ],
      },
      {
        title: "Choose the Next Honest Step",
        body: [
          "Ask yourself: what is the next honest step I can take in the next ten minutes? The answer might be emailing a teacher, drinking water, asking for help, or resting before trying again.",
        ],
      },
    ],
  },
  {
    id: "rest-is-part-of-it",
    title: "Rest Is Part of It",
    author: "Bawat Tala Library",
    category: "Gentle Care",
    estimatedMinutes: 5,
    rewardLabel: "3 stars",
    shelfLabel: "New on shelf",
    accentColor: "#F8E8BE",
    coverImage: BOOK_COVER_IMAGE,
    blurb: "A short permission slip for resting without treating it like failure.",
    chapters: [
      {
        title: "Rest Is Not a Reward",
        body: [
          "Rest is not something you earn only after becoming completely depleted. It is part of how you stay human while doing hard things.",
          "If your body is asking for stillness, it is giving you information, not betraying your goals.",
        ],
      },
      {
        title: "Try a Softer Measure",
        body: [
          "Instead of asking, Did I do enough today, try asking, What did I need today? Some days the answer is effort. Some days it is recovery. Both are valid.",
        ],
      },
      {
        title: "Return Without Punishing Yourself",
        body: [
          "When you are ready to come back, begin gently. The goal is not to make up for resting. The goal is to continue with a steadier mind and a kinder pace.",
        ],
      },
    ],
  },
];

export const FEATURED_LIBRARY_BOOKS = LIBRARY_BOOKS.slice(0, 3);
