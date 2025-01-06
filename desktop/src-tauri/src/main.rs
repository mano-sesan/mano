// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri_plugin_sql::{Migration, MigrationKind};

fn load_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_table_structure",
            sql: include_str!("../migrations/create_table_structure.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_table_territory",
            sql: include_str!("../migrations/create_table_territory.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

fn main() {
    let migrations = load_migrations();

    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:mydatabase.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
