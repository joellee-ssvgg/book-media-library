import { BookOpen, Database, Film, Footprints, Heart, Library, ListPlus, Settings } from "lucide-react";

export const privateNavItems = [
  { title: "今日书桌", href: "/dashboard", icon: Library, group: "工作台" },
  { title: "图书库", href: "/library", icon: BookOpen, group: "我的库" },
  { title: "影视库", href: "/library/films", icon: Film, group: "我的库" },
  { title: "足迹", href: "/maps", icon: Footprints, group: "我的库" },
  { title: "想读想看", href: "/lists/wishlist", icon: Heart, group: "清单" },
  { title: "我的清单", href: "/lists", icon: ListPlus, group: "清单" },
  { title: "编辑我的主页", href: "/settings/public", icon: Settings, group: "主页" },
  { title: "账号与数据", href: "/settings/data/export", icon: Database, group: "设置" },
];
