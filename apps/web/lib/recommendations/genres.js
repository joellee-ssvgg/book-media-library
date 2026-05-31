// 阅迹规范类型体系（canonical genres）。
// 这是推荐 / 筛选的"骨架"——一套小而稳、书影共用的双语类目。
// 来源标签（OpenLibrary subjects、Google Books BISAC categories、TMDB genres）
// 经清洗后通过 aliases 映射到这里；映射不中的长尾作为自由标签另存，不进此表。
//
// 维护方式：aliases 全部小写；新别名靠真实数据滚动收割后补进来（见 lib/recommendations/subjects.js）。

export const GENRES = [
  { id: "literary", zh: "文学小说", en: "Literary Fiction", aliases: ["literary fiction", "literature", "fiction", "novel", "general fiction", "文学", "小说"] },
  { id: "classics", zh: "经典文学", en: "Classics", aliases: ["classics", "classic literature", "classic", "经典", "名著"] },
  { id: "scifi", zh: "科幻", en: "Science Fiction", aliases: ["science fiction", "sci-fi", "scifi", "sf", "科幻", "硬科幻"] },
  { id: "fantasy", zh: "奇幻", en: "Fantasy", aliases: ["fantasy", "magic realism", "magical realism", "epic", "奇幻", "魔幻"] },
  { id: "mystery", zh: "推理悬疑", en: "Mystery & Thriller", aliases: ["mystery", "thriller", "thrillers", "detective", "suspense", "crime fiction", "gothic", "gothic fiction", "推理", "悬疑", "惊悚"] },
  { id: "horror", zh: "恐怖", en: "Horror", aliases: ["horror", "恐怖", "惊悚小说"] },
  { id: "romance", zh: "爱情", en: "Romance", aliases: ["romance", "love stories", "man-woman relationships", "言情", "爱情"] },
  { id: "historical_fiction", zh: "历史小说", en: "Historical Fiction", aliases: ["historical fiction", "historical", "历史小说"] },
  { id: "history", zh: "历史", en: "History", aliases: ["history", "world history", "historia", "histoire", "weltgeschichte", "historical chronology", "历史", "世界史"] },
  { id: "biography", zh: "传记回忆录", en: "Biography & Memoir", aliases: ["biography", "biography & autobiography", "autobiography", "memoir", "memoirs", "传记", "回忆录", "自传"] },
  { id: "science", zh: "科普", en: "Science", aliases: ["science", "life sciences", "evolution", "physics", "biology", "mathematics", "astronomy", "科普", "科学"] },
  { id: "technology", zh: "科技 / 计算机", en: "Technology & Computing", aliases: ["computers", "computer programming", "programming", "software", "technology", "engineering", "computer science", "计算机", "编程", "技术", "科技"] },
  { id: "business", zh: "经济管理", en: "Business & Economics", aliases: ["business & economics", "business", "economics", "management", "finance", "investing", "经济", "管理", "金融", "商业"] },
  { id: "psychology", zh: "心理", en: "Psychology", aliases: ["psychology", "心理", "心理学"] },
  { id: "philosophy", zh: "哲学", en: "Philosophy", aliases: ["philosophy", "ethics", "哲学", "伦理"] },
  { id: "selfhelp", zh: "自我成长", en: "Self-Help", aliases: ["self-help", "self help", "personal development", "motivational", "自我成长", "励志"] },
  { id: "social_science", zh: "社会科学", en: "Social Science", aliases: ["social science", "sociology", "anthropology", "social conditions", "civilization", "society", "社会", "社会学", "人类学"] },
  { id: "politics", zh: "政治", en: "Politics", aliases: ["political science", "politics", "government", "政治"] },
  { id: "health", zh: "健康", en: "Health & Wellness", aliases: ["health & fitness", "health", "fitness", "wellness", "medical", "健康", "养生"] },
  { id: "art", zh: "艺术", en: "Art & Design", aliases: ["art", "design", "photography", "architecture", "艺术", "设计", "摄影"] },
  { id: "music", zh: "音乐", en: "Music", aliases: ["music", "音乐"] },
  { id: "poetry", zh: "诗歌", en: "Poetry", aliases: ["poetry", "poems", "诗歌", "诗"] },
  { id: "essay", zh: "随笔散文", en: "Essays", aliases: ["essays", "essay", "literary collections", "随笔", "散文"] },
  { id: "comics", zh: "漫画", en: "Comics & Graphic Novels", aliases: ["comics & graphic novels", "comics", "graphic novels", "manga", "漫画"] },
  { id: "children", zh: "儿童", en: "Children's", aliases: ["juvenile fiction", "juvenile nonfiction", "children's", "children", "picture books", "儿童", "童书"] },
  { id: "youngadult", zh: "青少年", en: "Young Adult", aliases: ["young adult fiction", "young adult", "ya", "青少年"] },
  { id: "travel", zh: "旅行", en: "Travel", aliases: ["travel", "旅行", "游记"] },
  { id: "cooking", zh: "美食", en: "Food & Cooking", aliases: ["cooking", "food", "美食", "烹饪"] },
  { id: "religion", zh: "宗教 / 灵性", en: "Religion & Spirituality", aliases: ["religion", "spirituality", "buddhism", "christianity", "宗教", "灵性"] },
  { id: "nature", zh: "自然", en: "Nature", aliases: ["nature", "environment", "animals", "自然", "环境"] },
  { id: "education", zh: "教育", en: "Education", aliases: ["education", "study & teaching", "教育"] },
  { id: "comics_humor", zh: "幽默", en: "Humor", aliases: ["humor", "comedy", "幽默"] },
  // 影视偏多的类目（与图书共用骨架，TMDB genres 映射到这里）
  { id: "drama", zh: "剧情", en: "Drama", aliases: ["drama", "剧情"] },
  { id: "action", zh: "动作冒险", en: "Action & Adventure", aliases: ["action", "adventure", "action & adventure", "动作", "冒险"] },
  { id: "animation", zh: "动画", en: "Animation", aliases: ["animation", "animated", "动画"] },
  { id: "documentary", zh: "纪录", en: "Documentary", aliases: ["documentary", "纪录", "纪录片"] },
  { id: "crime", zh: "犯罪", en: "Crime", aliases: ["crime", "犯罪"] },
  { id: "war", zh: "战争", en: "War", aliases: ["war", "war & military", "战争", "军事"] },
  { id: "western", zh: "西部", en: "Western", aliases: ["western", "西部"] },
  { id: "family", zh: "家庭", en: "Family", aliases: ["family", "家庭"] },
];

// TMDB 电影类型 id → 规范类型 id（TMDB 的 19 个固定类型，干净规范）。
export const TMDB_GENRE_TO_CANONICAL = {
  28: "action", // Action
  12: "action", // Adventure
  16: "animation", // Animation
  35: "comics_humor", // Comedy
  80: "crime", // Crime
  99: "documentary", // Documentary
  18: "drama", // Drama
  10751: "family", // Family
  14: "fantasy", // Fantasy
  36: "history", // History
  27: "horror", // Horror
  10402: "music", // Music
  9648: "mystery", // Mystery
  10749: "romance", // Romance
  878: "scifi", // Science Fiction
  10770: "drama", // TV Movie
  53: "mystery", // Thriller
  10752: "war", // War
  37: "western", // Western
};

// 规范类型 id → OpenLibrary subject slug（用于「库外新书推荐」按类型浏览 /subjects/{slug}.json）。
// slug 全部已核对过 work_count > 0；只收录图书相关类型，影视专属类型（drama/action/…）不在内。
export const OL_SUBJECT_SLUG = {
  literary: "fiction",
  classics: "classic_literature",
  scifi: "science_fiction",
  fantasy: "fantasy",
  mystery: "mystery",
  horror: "horror",
  romance: "romance",
  historical_fiction: "historical_fiction",
  history: "history",
  biography: "biography",
  science: "science",
  technology: "computer_science",
  business: "business",
  psychology: "psychology",
  philosophy: "philosophy",
  selfhelp: "self-help",
  social_science: "social_sciences",
  politics: "politics",
  health: "health",
  art: "art",
  music: "music",
  poetry: "poetry",
  essay: "essays",
  children: "children",
  youngadult: "young_adult_fiction",
  travel: "travel",
  cooking: "cooking",
  religion: "religion",
  nature: "nature",
  education: "education",
};

const GENRE_BY_ID = new Map(GENRES.map((genre) => [genre.id, genre]));

/** 规范类型 id → 中文标签（找不到则原样返回）。 */
export function genreLabel(id) {
  return GENRE_BY_ID.get(id)?.zh ?? id;
}

/** 规范类型 id → 完整对象（zh/en/aliases）。 */
export function getGenre(id) {
  return GENRE_BY_ID.get(id) ?? null;
}

// alias（小写）→ 规范类型 id。较长的别名优先，降低误匹配。
export const ALIAS_TO_GENRE = (() => {
  const pairs = [];
  for (const genre of GENRES) {
    for (const alias of genre.aliases) {
      pairs.push([alias.toLowerCase(), genre.id]);
    }
  }
  pairs.sort((a, b) => b[0].length - a[0].length);
  return pairs;
})();
