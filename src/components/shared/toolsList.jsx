import { Youtube, BookOpen } from "lucide-react";

const TOOLS_LIST = [
  {
    name: "youtube_scraper",
    label: "YouTube Scraper",
    description: "Extract transcript text from any YouTube video.",
    icon: Youtube,
    status: "active",
    runs: 0,
  },
  {
    name: "kb_expander",
    label: "KB Expander",
    description: "Expand a knowledge base with new content.",
    icon: BookOpen,
    status: "active",
    runs: 0,
  },
];

export default TOOLS_LIST;