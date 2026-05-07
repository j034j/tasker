
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
    | 'location_label'
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
    | 'show_archived'
    | 'interest_you_only'
    | 'interest_you'
    | 'interest_others'
    | 'interest_people'
    | 'algo_config'
    | 'algo_desc'
    | 'w_due_date'
    | 'w_weather'
    | 'header_welcome'
    | 'header_tasks'
    | 'header_tasks_from'
    | 'w_funding'
    | 'w_skills'
    | 'create_board_title'
    | 'board_name_label'
    | 'board_name_placeholder'
    | 'visibility_label'
    | 'vis_private'
    | 'vis_private_desc'
    | 'vis_public'
    | 'vis_public_desc'
    | 'create_board_btn'
    | 'creating_board_btn'
    | 'discovery_title'
    | 'browse_boards'
    | 'switch_org'
    | 'discovery_desc'
    | 'public_badge'
    | 'created_by'
    | 'join'
    | 'leave'
    | 'no_public_boards'
    | 'search_org_placeholder'
    | 'searching'
    | 'search_btn'
    | 'current_badge'
    | 'boards_count'
    | 'creator_label'
    | 'switch_btn'
    | 'no_orgs_found'
    | 'auth_signin'
    | 'auth_create'
    | 'auth_join'
    | 'auth_new_org_name'
    | 'auth_your_name'
    | 'auth_email'
    | 'auth_password'
    | 'auth_find_org'
    | 'auth_find_btn'
    | 'auth_select_org'
    | 'auth_creator'
    | 'auth_boards'
    | 'auth_selected'
    | 'auth_select_boards'
    | 'auth_no_boards'
    | 'auth_processing'
    | 'auth_create_join'
    | 'auth_join_workspace_btn'
    | 'auth_no_account'
    | 'auth_create_workspace'
    | 'auth_join_workspace'
    | 'auth_have_account'
    | 'auth_login'
    | 'auth_org_not_found'
    | 'auth_auth_failed'
    | 'auth_select_org_err'
    | 'dash_boards_label'
    | 'dash_browse_title'
    | 'dash_unfollow'
    | 'dash_follow'
    | 'dash_archive'
    | 'dash_delete'
    | 'dash_new_btn'
    | 'dash_create_first'
    | 'dash_browse_btn'
    | 'dash_empty_msg'
    | 'dash_create_btn'
    | 'dash_browse_all'
    | 'translate_btn'
    | 'translating'
    | 'auth_phone_optional'
    | 'profile_title'
    | 'profile_new_password'
    | 'profile_password_hint'
    | 'profile_save_btn'
    // Task Dependencies
    | 'dependencies_title'
    | 'dependencies_current'
    | 'dependencies_add_new'
    | 'dependencies_parent_label'
    | 'dependencies_child_label'
    | 'dependencies_select_placeholder'
    | 'dependencies_create_btn'
    | 'dependencies_creating'
    | 'dependencies_no_deps'
    | 'dependencies_remove_confirm'
    | 'dependencies_error_self'
    | 'dependencies_error_circular'
    // Task Activity Snapshot
    | 'task_activity_snapshot'
    | 'recent_signals'
    | 'open_snapshot'
    | 'hide_snapshot'
    | 'no_activity'
    | 'total_tasks'
    | 'in_progress'
    | 'completed'
    | 'new_this_week'
    | 'green_new'
    | 'yellow_progress'
    | 'red_urgent'
    | 'white_done'
    | 'multi_color'
    | 'all_departments'
    | 'day_focus'
    | 'no_day_selected'
    | 'refreshing'
    | 'latest_activity'
    | 'expand_snapshot'
    // Central Board
    | 'central_board'
    | 'central_board_desc'
    | 'all_departments_label'
    | 'select_department_label'
    | 'boards_in_dept'
    | 'tasks_count'
    | 'no_tasks_in_dept'
    | 'view_task'
    | 'combine_all';

export const translations: Record<Language, Record<TranslationKey, string>> = {
    en: {
        app_title: 'Tasker',
        subtitle: 'The intelligent ranking engine',
        header_welcome: 'Welcome',
        header_tasks: ', here are your tasks',
        header_tasks_from: 'Here are your tasks from',
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
        location_label: 'Location',
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
        show_archived: 'Show Archived',
        interest_you_only: 'You are interested',
        interest_you: 'You',
        interest_others: 'others',
        interest_people: 'people interested',
        algo_config: 'Algorithm Configuration',
        algo_desc: 'Adjust the weights to customize how task urgency is calculated.',
        w_due_date: 'Due Date Weight',
        w_weather: 'Weather Weight',
        w_funding: 'Funding Weight',
        w_skills: 'Skills Weight',

        // Create Board Modal
        create_board_title: 'Create New Board',
        board_name_label: 'Board Name',
        board_name_placeholder: 'Project Roadmap',
        visibility_label: 'Visibility',
        vis_private: 'Private',
        vis_private_desc: 'Only members can join.',
        vis_public: 'Public',
        vis_public_desc: 'Anyone in org can see.',
        create_board_btn: 'Create Board',
        creating_board_btn: 'Creating...',

        // Discovery Modal
        discovery_title: 'Discovery',
        browse_boards: 'Browse Boards',
        switch_org: 'Switch Organization',
        discovery_desc: 'Join public boards in your current organization to see them in your dashboard.',
        public_badge: 'Public',
        created_by: 'Created by',
        join: 'Join',
        leave: 'Leave',
        no_public_boards: 'No public boards found in this organization.',
        search_org_placeholder: 'Search for an organization...',
        searching: 'Searching...',
        search_btn: 'Search',
        current_badge: 'Current',
        boards_count: 'Boards',
        creator_label: 'Creator',
        switch_btn: 'Switch',
        no_orgs_found: 'No organizations found matching',
        // Auth Screen
        auth_signin: 'Sign In',
        auth_create: 'Create',
        auth_join: 'Join',
        auth_new_org_name: 'New Organization Name',
        auth_your_name: 'Your Name',
        auth_email: 'Email',
        auth_password: 'Password',
        auth_find_org: 'Find Organization',
        auth_find_btn: 'Find',
        auth_select_org: 'Select Organization:',
        auth_creator: 'Creator:',
        auth_boards: 'Boards',
        auth_selected: 'Selected:',
        auth_select_boards: 'Select Boards to Join:',
        auth_no_boards: 'No boards found.',
        auth_processing: 'Processing...',
        auth_create_join: 'Create & Join',
        auth_join_workspace_btn: 'Join Workspace',
        auth_no_account: "Don't have an account?",
        auth_create_workspace: 'Create Workspace',
        auth_join_workspace: 'Join Workspace',
        auth_have_account: 'Already have an account?',
        auth_login: 'Log In',
        auth_org_not_found: 'Organization not found. Check spelling.',
        auth_auth_failed: 'Authentication failed',
        auth_select_org_err: 'Please select an organization.',

        // Dashboard / App
        dash_boards_label: 'Board',
        dash_browse_title: 'Browse Boards in Org',
        dash_unfollow: 'Unfollow Board',
        dash_follow: 'Follow Board',
        dash_archive: 'Archive Board',
        dash_delete: 'Delete Board',
        dash_new_btn: 'New',
        dash_create_first: 'Create First Board',
        dash_browse_btn: 'Browse Boards',
        dash_empty_msg: 'Select or create a board to get started.',
        dash_create_btn: 'Create Board',
        dash_browse_all: 'Browse All Boards',
        translate_btn: 'Translate Content',
        translating: 'Translating...',

        // Task Activity Snapshot
        task_activity_snapshot: 'Task Activity Snapshot',
        recent_signals: 'recent signals',
        open_snapshot: 'Open Snapshot',
        hide_snapshot: 'Hide Snapshot',
        no_activity: 'No activity',
        total_tasks: 'Total tasks',
        in_progress: 'In progress',
        completed: 'Completed',
        new_this_week: 'New this week',
        green_new: 'Green = newly created',
        yellow_progress: 'Yellow = in progress',
        red_urgent: 'Red = urgent',
        white_done: 'White = completed',
        multi_color: 'Multi-color tiles combine signals',
        all_departments: 'All Departments',
        day_focus: 'Day Focus',
        no_day_selected: 'No day selected',
        refreshing: 'Refreshing...',
        latest_activity: 'Latest activity',
        expand_snapshot: 'Expand for the full day grid and clickable task list.',

        // Central Board
        central_board: 'Central Board',
        central_board_desc: 'View all tasks from across departments in one unified view',
        all_departments_label: 'All Departments',
        select_department_label: 'Filter by Department',
        boards_in_dept: 'Boards',
        tasks_count: 'Tasks',
        no_tasks_in_dept: 'No tasks in this department yet',
        combine_all: 'Combine All',
        view_task: 'View Task',

        auth_phone_optional: 'Phone Number (Optional)',
        profile_title: 'My Profile',
        profile_new_password: 'New Password (Optional)',
        profile_password_hint: 'Leave blank to keep current password',
        profile_save_btn: 'Save Changes',
        dependencies_title: 'Task Dependencies',
        dependencies_current: 'Current Dependencies',
        dependencies_add_new: 'Add New Dependency',
        dependencies_parent_label: 'Parent Task (Pre-requisite)',
        dependencies_child_label: 'Child Task (Dependent)',
        dependencies_select_placeholder: 'Select task (optional, default: current)',
        dependencies_create_btn: 'Link Tasks',
        dependencies_creating: 'Linking...',
        dependencies_no_deps: 'No dependencies linked yet.',
        dependencies_remove_confirm: 'Are you sure you want to remove this dependency?',
        dependencies_error_self: 'Cannot create dependency on self',
        dependencies_error_circular: 'Circular dependency detected'
    },
    de: {
        app_title: 'Tasker - Aufgabenplaner',
        subtitle: 'Die intelligente Priorisierungs-Engine',
        header_welcome: 'Willkommen',
        header_tasks: ', hier sind Ihre Aufgaben',
        header_tasks_from: 'Hier sind Ihre Aufgaben von',
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
        location_label: 'Standort',
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
        show_archived: 'Archiviertes anzeigen',

        interest_you_only: 'Du bist interessiert',
        interest_you: 'Du',
        interest_others: 'andere',
        interest_people: 'Leute interessiert',
        algo_config: 'Algorithmus-Konfiguration',
        algo_desc: 'Passen Sie die Gewichtungen an, um die Dringlichkeitsberechnung anzupassen.',
        w_due_date: 'Gewichtung Fälligkeit',
        w_weather: 'Gewichtung Wetter',
        w_funding: 'Gewichtung Budget',
        w_skills: 'Gewichtung Fähigkeiten',

        // Create Board Modal
        create_board_title: 'Neues Board Erstellen',
        board_name_label: 'Board Name',
        board_name_placeholder: 'Projekt-Roadmap',
        visibility_label: 'Sichtbarkeit',
        vis_private: 'Privat',
        vis_private_desc: 'Nur Mitglieder können beitreten.',
        vis_public: 'Öffentlich',
        vis_public_desc: 'Jeder in der Organisation kann es sehen.',
        create_board_btn: 'Board Erstellen',
        creating_board_btn: 'Erstellt...',

        // Discovery Modal
        discovery_title: 'Entdecken',
        browse_boards: 'Boards Durchsuchen',
        switch_org: 'Organisation Wechseln',
        discovery_desc: 'Treten Sie öffentlichen Boards in Ihrer Organisation bei.',
        public_badge: 'Öffentlich',
        created_by: 'Erstellt von',
        join: 'Beitreten',
        leave: 'Verlassen',
        no_public_boards: 'Keine öffentlichen Boards in dieser Organisation gefunden.',
        search_org_placeholder: 'Nach Organisation suchen...',
        searching: 'Suchen...',
        search_btn: 'Suchen',
        current_badge: 'Aktuell',
        boards_count: 'Boards',
        creator_label: 'Ersteller',
        switch_btn: 'Wechseln',
        no_orgs_found: 'Keine Organisationen gefunden für',

        // Auth Screen
        auth_signin: 'Anmelden',
        auth_create: 'Erstellen',
        auth_join: 'Beitreten',
        auth_new_org_name: 'Neuer Organisationsname',
        auth_your_name: 'Ihr Name',
        auth_email: 'E-Mail',
        auth_password: 'Passwort',
        auth_find_org: 'Organisation Finden',
        auth_find_btn: 'Finden',
        auth_select_org: 'Organisation Wählen:',
        auth_creator: 'Ersteller:',
        auth_boards: 'Boards',
        auth_selected: 'Ausgewählt:',
        auth_select_boards: 'Boards zum Beitreten wählen:',
        auth_no_boards: 'Keine Boards gefunden.',
        auth_processing: 'Verarbeite...',
        auth_create_join: 'Erstellen & Beitreten',
        auth_join_workspace_btn: 'Workspace Beitreten',
        auth_no_account: "Noch kein Konto?",
        auth_create_workspace: 'Workspace Erstellen',
        auth_join_workspace: 'Workspace Beitreten',
        auth_have_account: 'Bereits registriert?',
        auth_login: 'Einloggen',
        auth_org_not_found: 'Organisation nicht gefunden.',
        auth_auth_failed: 'Authentifizierung fehlgeschlagen',
        auth_select_org_err: 'Bitte wählen Sie eine Organisation.',

        // Dashboard / App
        dash_boards_label: 'Board',
        dash_browse_title: 'Boards durchsuchen',
        dash_unfollow: 'Board entfolgen',
        dash_follow: 'Board folgen',
        dash_archive: 'Board archivieren',
        dash_delete: 'Board löschen',
        dash_new_btn: 'Neu',
        dash_create_first: 'Erstes Board erstellen',
        dash_browse_btn: 'Boards durchsuchen',
        dash_empty_msg: 'Wählen oder erstellen Sie ein Board, um zu beginnen.',
        dash_create_btn: 'Board erstellen',
        dash_browse_all: 'Alle Boards durchsuchen',
        translate_btn: 'Inhalt übersetzen',
        translating: 'Übersetzen...',
        auth_phone_optional: 'Telefonnummer (Optional)',
        profile_title: 'Mein Profil',
        profile_new_password: 'Neues Passwort (Optional)',
        profile_password_hint: 'Leer lassen, um aktuelles Passwort zu behalten',
        profile_save_btn: 'Änderungen speichern',
        dependencies_title: 'Aufgaben-Abhängigkeiten',
        dependencies_current: 'Aktuelle Abhängigkeiten',
        dependencies_add_new: 'Neue Abhängigkeit hinzufügen',
        dependencies_parent_label: 'Vorgänger-Aufgabe (Voraussetzung)',
        dependencies_child_label: 'Nachfolger-Aufgabe (Abhängig)',
        dependencies_select_placeholder: 'Aufgabe wählen (optional, Standard: aktuell)',
        dependencies_create_btn: 'Aufgaben Verknüpfen',
        dependencies_creating: 'Verknüpfe...',
        dependencies_no_deps: 'Noch keine Abhängigkeiten verknüpft.',
        dependencies_remove_confirm: 'Sind Sie sicher, dass Sie diese Abhängigkeit entfernen möchten?',
        dependencies_error_self: 'Abhängigkeit von sich selbst nicht möglich',
        dependencies_error_circular: 'Zirkuläre Abhängigkeit erkannt',

        // Task Activity Snapshot
        task_activity_snapshot: 'Aufgaben-Aktivitätsübersicht',
        recent_signals: 'aktuelle Signale',
        open_snapshot: 'Übersicht öffnen',
        hide_snapshot: 'Übersicht schließen',
        no_activity: 'Keine Aktivität',
        total_tasks: 'Aufgaben gesamt',
        in_progress: 'In Bearbeitung',
        completed: 'Abgeschlossen',
        new_this_week: 'Neu diese Woche',
        green_new: 'Grün = neu erstellt',
        yellow_progress: 'Gelb = in Bearbeitung',
        red_urgent: 'Rot = dringend',
        white_done: 'Weiß = abgeschlossen',
        multi_color: 'Mehrfarbig = Signale kombiniert',
        all_departments: 'Alle Abteilungen',
        day_focus: 'Tagesfokus',
        no_day_selected: 'Kein Tag ausgewählt',
        refreshing: 'Aktualisiere...',
        latest_activity: 'Letzte Aktivität',
        expand_snapshot: 'Für vollständiges Tagesraster und klickbare Aufgabenliste erweitern',

        // Central Board
        central_board: 'Zentrales Board',
        central_board_desc: 'Alle Aufgaben aus allen Abteilungen in einer einheitlichen Ansicht',
        all_departments_label: 'Alle Abteilungen',
        select_department_label: 'Nach Abteilung filtern',
        boards_in_dept: 'Boards',
        tasks_count: 'Aufgaben',
        no_tasks_in_dept: 'Noch keine Aufgaben in dieser Abteilung',
        combine_all: 'Alle kombinieren',
        view_task: 'Aufgabe anzeigen'
    }
};
