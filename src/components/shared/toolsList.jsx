import { Image, Globe, Video } from "lucide-react";

const TOOLS_LIST = [
  {
    name: "carousel_creator",
    label: "Створення каруселей",
    description: "Автоматизована генерація каруселей для соціальних мереж",
    icon: Image,
    status: "active",
    runs: 0,
  },
  {
    name: "site_builder",
    label: "Створення сайтів",
    description: "Створення та запуск сайтів під міні-продукти, інфобіз",
    icon: Globe,
    status: "active",
    runs: 0,
  },
  {
    name: "reels_generator",
    label: "Генерація рілсів",
    description: "Створення відео-рілсів для соціальних мереж",
    icon: Video,
    status: "active",
    runs: 0,
  },
];

export default TOOLS_LIST;
