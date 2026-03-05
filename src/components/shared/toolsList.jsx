import { Terminal, Globe, Database, FileCode, Cpu, Cog } from "lucide-react";

const TOOLS_LIST = [
  { name: "script_runner", label: "Script Runner", description: "Execute custom scripts and automations", icon: Terminal, status: "active", runs: 142 },
  { name: "web_scraper", label: "Web Scraper", description: "Extract data from websites and APIs", icon: Globe, status: "active", runs: 89 },
  { name: "data_processor", label: "Data Processor", description: "Transform and analyze datasets", icon: Database, status: "active", runs: 234 },
  { name: "code_generator", label: "Code Generator", description: "Generate code snippets and templates", icon: FileCode, status: "offline", runs: 67 },
  { name: "local_ai_bridge", label: "Local AI Bridge", description: "Connect to local AI models and services", icon: Cpu, status: "active", runs: 156 },
  { name: "system_utility", label: "System Utility", description: "System maintenance and monitoring tools", icon: Cog, status: "active", runs: 312 },
];

export default TOOLS_LIST;