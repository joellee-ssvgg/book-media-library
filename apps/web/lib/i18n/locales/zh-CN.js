const zhCN = {
    media: {
        book: {
            label: "书",
            status: {
                want_to_read: "想读",
                reading: "在读",
                finished: "读完",
                abandoned: "弃读",
            },
        },
        movie: {
            label: "电影",
            status: {
                want_to_watch: "想看",
                watching: "在看",
                watched: "看完",
                abandoned: "弃看",
            },
        },
    },
    progress: {
        book: {
            unit_page: "页",
            unit_percent: "%",
            label_pages_read: "已读 {n} 页",
            label_session: "今日阅读 {minutes} 分钟，{pages} 页",
        },
        movie: {
            label_watched_on: "{date} 已观看",
        },
    },
    rating: {
        label: "评分",
        half_star: "{n} 星",
        not_rated: "未评分",
    },
    visibility: {
        private: "仅自己",
        unlisted: "未列出",
        followers: "关注者",
        public: "公开",
    },
    ui: {
        onboarding: {
            step1: {
                title: "你的用户名",
            },
            step2: {
                title: "选择起点",
                choose_three: "选 3 部最爱",
                import_csv: "我有历史数据",
            },
            cta_continue: "继续",
            cta_skip: "跳过",
        },
        dashboard: {
            empty_state: {
                title: "还没有记录，从添加一本书或一部电影开始",
                cta_add: "+ 添加",
            },
            continue_reading: "继续阅读",
            recent_finished: "最近完成",
            stalled: "停滞条目",
            completed_this_year: "今年完成",
        },
        library: {
            title: "我的库",
            filter_status: "状态",
            filter_media: "媒介",
            empty: "暂无条目",
        },
        manual_work: {
            media_type: "类型",
        },
    },
    error: {
        entry_not_found: "条目不存在",
        network: {
            offline_write_disabled: "离线时写入已禁用，请联网后再提交。",
        },
    },
};
export default zhCN;
