const enUS = {
  media: {
    book: {
      label: "Book",
      status: {
        want_to_read: "Want to read",
        reading: "Reading",
        finished: "Finished",
        abandoned: "Abandoned",
      },
    },
    movie: {
      label: "Movie",
      status: {
        want_to_watch: "Want to watch",
        watching: "Watching",
        watched: "Watched",
        abandoned: "Abandoned",
      },
    },
  },
  progress: {
    book: {
      unit_page: "page",
      unit_percent: "%",
      label_pages_read: "{n} pages read",
      label_session: "{minutes} minutes and {pages} pages today",
    },
    movie: {
      label_watched_on: "Watched on {date}",
    },
  },
  rating: {
    label: "Rating",
    half_star: "{n} stars",
    not_rated: "Not rated",
  },
  visibility: {
    private: "Private",
    unlisted: "Unlisted",
    followers: "Followers",
    public: "Public",
  },
  ui: {
    onboarding: {
      step1: {
        title: "Your username",
      },
      step2: {
        title: "Choose a starting point",
        choose_three: "Pick 3 favorites",
        import_csv: "I have history data",
      },
      cta_continue: "Continue",
      cta_skip: "Skip",
    },
    dashboard: {
      empty_state: {
        title: "No records yet. Start by adding a book or movie.",
        cta_add: "+ Add",
      },
      continue_reading: "Continue reading",
      recent_finished: "Recently finished",
      stalled: "Stalled",
      completed_this_year: "Completed this year",
    },
    library: {
      title: "My library",
      filter_status: "Status",
      filter_media: "Media",
      empty: "No items yet",
    },
    manual_work: {
      media_type: "Type",
    },
  },
  error: {
    entry_not_found: "Entry not found",
    network: {
      offline_write_disabled: "Offline writes are disabled. Reconnect before submitting.",
    },
  },
} as const;

export default enUS;
