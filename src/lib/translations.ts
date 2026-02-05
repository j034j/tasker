
export type Language = 'en' | 'de';

export type TranslationKey =
    // App / Header
    | 'app_title'
    | 'subtitle'
    | 'new_board'
    | 'search_placeholder'
    | 'welcome_title'
    | 'welcome_subtitle'
    | 'org_placeholder'
    | 'create_workspace'
    | 'setup_msg'
    | 'enter_org_msg'
    // Kanban Columns
    | 'col_todo'
    | 'col_progress'
    | 'col_review'
    | 'col_done'
    | 'col_blocked'
    // Task Card / Modal
    | 'task_new'
    | 'task_edit'
    | 'title_label'
    | 'desc_label'
    | 'urgency_label'
    | 'urgency_expl'
    | 'people_label'
    | 'funding_label'
    | 'skills_label'
    | 'season_label'
    | 'due_date_label'
    | 'weather_sensitive'
    | 'weather_sensitive_label'
    | 'weather_impact_msg'
    | 'auto_generate'
    | 'cancel'
    | 'save'
    | 'creating'
    | 'saving'
    | 'high'
    | 'medium'
    | 'low'
    // Seasons
    | 'season_winter'
    | 'season_spring'
    | 'season_summer'
    | 'season_autumn'
    | 'season_flexible'
    | 'move_action'
    | 'delete_confirm'
    | 'archive_action'
    | 'restore_action'
    | 'show_archived';

export const translations: Record<Language, Record<TranslationKey, string>> = {
    en: {
        app_title: 'Tasker',
        subtitle: 'The intelligent ranking engine',
        new_board: 'New Board',
        search_placeholder: 'Search tasks...',
        welcome_title: 'Welcome to Tasker',
        welcome_subtitle: 'The intelligent ranking engine for your tasks.',
        org_placeholder: 'Organization Name',
        create_workspace: 'Create Workspace →',
        setup_msg: 'Setting up...',
        enter_org_msg: 'Enter your organization name to create a secure workspace.',

        col_todo: 'To Do',
        col_progress: 'In Progress',
        col_review: 'Review',
        col_done: 'Done',
        col_blocked: 'Blocked',

        task_new: 'New Task',
        task_edit: 'Edit Task',
        title_label: 'Task Title',
        desc_label: 'Description',
        urgency_label: 'Auto-Calculated Urgency',
        urgency_expl: 'Derived from Due Date, Weather, Funding, and Labor factors.',
        people_label: 'People Required',
        funding_label: 'Funding Needed (€/$)',
        skills_label: 'Special Skills (Tags)',
        season_label: 'Project Season',
        due_date_label: 'Due Date',
        weather_sensitive: 'Weather Sensitive',
        weather_sensitive_label: 'Weather Sensitive Task',
        weather_impact_msg: 'Urgency Boost due to Weather',
        auto_generate: 'Auto-Generate',
        cancel: 'Cancel',
        save: 'Save Changes',
        creating: 'Create Task',
        saving: 'Saving...',

        high: 'HIGH',
        medium: 'MEDIUM',
        low: 'LOW',

        season_winter: 'Winter',
        season_spring: 'Spring',
        season_summer: 'Summer',
        season_autumn: 'Autumn',
        season_flexible: 'Flexible / All Year',
        move_action: 'Move',
        delete_confirm: 'Are you sure you want to delete this task?',
        archive_action: 'Archive',
        restore_action: 'Restore',
        show_archived: 'Show Archived'
    },
    de: {
        app_title: 'Tasker',
        subtitle: 'Die intelligente Priorisierungs-Engine',
        new_board: 'Neues Board',
        search_placeholder: 'Aufgaben suchen...',
        welcome_title: 'Willkommen bei Tasker',
        welcome_subtitle: 'Die intelligente Priorisierungs-Engine für Ihre Aufgaben.',
        org_placeholder: 'Organisationsname',
        create_workspace: 'Workspace Erstellen →',
        setup_msg: 'Einrichtung...',
        enter_org_msg: 'Geben Sie Ihren Organisationsnamen ein, um zu beginnen.',

        col_todo: 'Zu Erledigen',
        col_progress: 'In Bearbeitung',
        col_review: 'Prüfung',
        col_done: 'Erledigt',
        col_blocked: 'Blockiert',

        task_new: 'Neue Aufgabe',
        task_edit: 'Aufgabe Bearbeiten',
        title_label: 'Titel',
        desc_label: 'Beschreibung',
        urgency_label: 'Berechnete Dringlichkeit',
        urgency_expl: 'Basiert auf Datum, Wetter, Budget und Personal.',
        people_label: 'Benötigtes Personal',
        funding_label: 'Benötigte Mittel (€)',
        skills_label: 'Spezialfähigkeiten',
        season_label: 'Projektsaison',
        due_date_label: 'Fälligkeitsdatum',
        weather_sensitive: 'Wetterabhängig',
        weather_sensitive_label: 'Wetterabhängige Aufgabe',
        weather_impact_msg: 'Dringlichkeit erhöht durch Wetter',
        auto_generate: 'Automatisch',
        cancel: 'Abbrechen',
        save: 'Speichern',
        creating: 'Erstellen',
        saving: 'Speichert...',

        high: 'HOCH',
        medium: 'MITTEL',
        low: 'NIEDRIG',

        season_winter: 'Winter',
        season_spring: 'Frühling',
        season_summer: 'Sommer',
        season_autumn: 'Herbst',
        season_flexible: 'Flexibel / Ganzjährig',
        move_action: 'Verschieben',
        delete_confirm: 'Sind Sie sicher, dass Sie diese Aufgabe löschen möchten?',
        archive_action: 'Archivieren',
        restore_action: 'Wiederherstellen',
        show_archived: 'Archiviertes anzeigen'
    }
};
