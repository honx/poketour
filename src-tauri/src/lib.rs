// Library entry — `main.rs` calls into here so we get a single place for the
// Tauri runtime setup. No custom commands yet: the whole game runs in the
// frontend (see frontend/src/game/*), Tauri only provides the shell window
// and packaging.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running Poketour");
}
