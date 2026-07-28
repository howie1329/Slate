#[cfg(target_os = "macos")]
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, EventTarget, Manager, PhysicalPosition, Position, Rect, Runtime,
    WebviewWindow,
};
#[cfg(target_os = "macos")]
use tauri_nspanel::{
    objc2::MainThreadMarker as ObjcMainThreadMarker,
    objc2_app_kit::{NSApplication, NSWindowCollectionBehavior},
    tauri_panel, CollectionBehavior, ManagerExt, PanelLevel, StyleMask, WebviewWindowExt,
};

#[cfg(target_os = "macos")]
tauri_panel! {
    panel!(SlatePopoverPanel {
        config: {
            can_become_key_window: true,
            can_become_main_window: false,
            is_floating_panel: true,
        }
    })
}

pub const MAIN_WINDOW_LABEL: &str = "main";
pub const POPOVER_WINDOW_LABEL: &str = "popover";
pub const QUICK_CAPTURE_WINDOW_LABEL: &str = "quick-capture";

const OPEN_FULL_APP_MENU_ID: &str = "open-full-app";
const QUIT_MENU_ID: &str = "quit";
const POPOVER_MARGIN: i32 = 12;

#[cfg(target_os = "macos")]
#[derive(Default)]
struct QuickCaptureFocusState {
    has_received_focus: AtomicBool,
}

pub fn setup<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        app.set_activation_policy(tauri::ActivationPolicy::Accessory)?;
        app.manage(QuickCaptureFocusState::default());
    }

    let popover = popover_window(app)?;
    configure_macos_popover(&popover)?;
    let quick_capture = quick_capture_window(app)?;
    configure_macos_quick_capture(&quick_capture)?;

    let open_full_app_item = MenuItem::with_id(
        app,
        OPEN_FULL_APP_MENU_ID,
        "Open Full App",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, QUIT_MENU_ID, "Quit Slate", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_full_app_item, &quit])?;

    TrayIconBuilder::with_id("slate-tray")
        .icon(menu_bar_icon())
        .icon_as_template(true)
        .tooltip("Slate")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            OPEN_FULL_APP_MENU_ID => {
                if let Err(error) = open_full_app(app) {
                    eprintln!("failed to open Slate's full app window: {error}");
                }
            }
            QUIT_MENU_ID => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                if let Err(error) = toggle_popover(tray.app_handle(), rect) {
                    eprintln!("failed to toggle Slate's menu-bar popover: {error}");
                }
            }
        })
        .build(app)?;

    Ok(())
}

pub fn toggle_popover<R: Runtime>(app: &AppHandle<R>, tray_rect: Rect) -> tauri::Result<()> {
    let popover = popover_window(app)?;

    if popover.is_visible()? {
        return popover.hide();
    }

    position_popover(app, &popover, tray_rect)?;
    show_popover(app, &popover)
}

pub fn hide_popover<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    popover_window(app)?.hide()
}

pub fn open_quick_capture<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let quick_capture = quick_capture_window(app)?;
    #[cfg(target_os = "macos")]
    if !quick_capture.is_focused()? {
        app.state::<QuickCaptureFocusState>()
            .has_received_focus
            .store(false, Ordering::Release);
    }
    position_quick_capture(app, &quick_capture)?;
    #[cfg(target_os = "macos")]
    {
        activate_macos_app();
        let panel = app
            .get_webview_panel(QUICK_CAPTURE_WINDOW_LABEL)
            .map_err(|_| missing_window_error(QUICK_CAPTURE_WINDOW_LABEL))?;
        panel.show_and_make_key();
    }
    #[cfg(not(target_os = "macos"))]
    {
        quick_capture.show()?;
        quick_capture.set_focus()?;
    }
    quick_capture.emit_to(
        EventTarget::webview_window(QUICK_CAPTURE_WINDOW_LABEL),
        "quick-capture://opened",
        (),
    )?;
    Ok(())
}

pub fn hide_quick_capture<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    quick_capture_window(app)?.hide()
}

pub fn open_full_app<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    hide_popover(app)?;

    let main = main_window(app)?;
    main.unminimize()?;
    main.show()?;
    main.set_focus()?;
    main.set_fullscreen(true)?;

    #[cfg(target_os = "macos")]
    app.set_activation_policy(tauri::ActivationPolicy::Regular)?;

    Ok(())
}

pub fn handle_window_event<R: Runtime>(window: &tauri::Window<R>, event: &tauri::WindowEvent) {
    match event {
        tauri::WindowEvent::CloseRequested { api, .. }
            if matches!(
                window.label(),
                MAIN_WINDOW_LABEL | POPOVER_WINDOW_LABEL | QUICK_CAPTURE_WINDOW_LABEL
            ) =>
        {
            api.prevent_close();
            if let Err(error) = window.hide() {
                eprintln!("failed to hide Slate window after close request: {error}");
            }
            #[cfg(target_os = "macos")]
            if window.label() == MAIN_WINDOW_LABEL {
                if let Err(error) = window
                    .app_handle()
                    .set_activation_policy(tauri::ActivationPolicy::Accessory)
                {
                    eprintln!("failed to restore Slate's menu-bar activation policy: {error}");
                }
            }
        }
        tauri::WindowEvent::Focused(false) if window.label() == POPOVER_WINDOW_LABEL => {
            if let Err(error) = window.hide() {
                eprintln!("failed to hide transient Slate window after focus loss: {error}");
            }
        }
        #[cfg(target_os = "macos")]
        tauri::WindowEvent::Focused(true) if window.label() == QUICK_CAPTURE_WINDOW_LABEL => {
            window
                .app_handle()
                .state::<QuickCaptureFocusState>()
                .has_received_focus
                .store(true, Ordering::Release);
        }
        #[cfg(target_os = "macos")]
        tauri::WindowEvent::Focused(false) if window.label() == QUICK_CAPTURE_WINDOW_LABEL => {
            let should_hide = window
                .app_handle()
                .state::<QuickCaptureFocusState>()
                .has_received_focus
                .swap(false, Ordering::AcqRel);
            if should_hide {
                if let Err(error) = window.hide() {
                    eprintln!("failed to hide quick capture window after focus loss: {error}");
                }
            }
        }
        #[cfg(not(target_os = "macos"))]
        tauri::WindowEvent::Focused(false) if window.label() == QUICK_CAPTURE_WINDOW_LABEL => {
            if let Err(error) = window.hide() {
                eprintln!("failed to hide quick capture window after focus loss: {error}");
            }
        }
        _ => {}
    }
}

#[cfg(target_os = "macos")]
fn activate_macos_app() {
    let Some(main_thread) = ObjcMainThreadMarker::new() else {
        eprintln!("failed to activate Slate for quick capture: not on the main thread");
        return;
    };
    let application = NSApplication::sharedApplication(main_thread);
    #[allow(deprecated)]
    application.activateIgnoringOtherApps(true);
}

fn main_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<WebviewWindow<R>> {
    app.get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| missing_window_error(MAIN_WINDOW_LABEL))
}

fn popover_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<WebviewWindow<R>> {
    app.get_webview_window(POPOVER_WINDOW_LABEL)
        .ok_or_else(|| missing_window_error(POPOVER_WINDOW_LABEL))
}

fn quick_capture_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<WebviewWindow<R>> {
    app.get_webview_window(QUICK_CAPTURE_WINDOW_LABEL)
        .ok_or_else(|| missing_window_error(QUICK_CAPTURE_WINDOW_LABEL))
}

fn missing_window_error(label: &str) -> tauri::Error {
    tauri::Error::AssetNotFound(format!("window {label} is not available"))
}

fn position_popover<R: Runtime>(
    app: &AppHandle<R>,
    popover: &WebviewWindow<R>,
    tray_rect: Rect,
) -> tauri::Result<()> {
    let Some(monitor) = monitor_for_tray(app, tray_rect)? else {
        return Ok(());
    };

    let popover_size = popover.outer_size()?;
    let work_area = monitor.work_area();
    let max_x =
        work_area.position.x + work_area.size.width.saturating_sub(popover_size.width) as i32;
    let max_y =
        work_area.position.y + work_area.size.height.saturating_sub(popover_size.height) as i32;
    let x = clamp_to_work_area(max_x - POPOVER_MARGIN, work_area.position.x, max_x);
    let y = clamp_to_work_area(
        work_area.position.y + POPOVER_MARGIN,
        work_area.position.y,
        max_y,
    );

    popover.set_position(PhysicalPosition::new(x, y))
}

fn position_quick_capture<R: Runtime>(
    app: &AppHandle<R>,
    quick_capture: &WebviewWindow<R>,
) -> tauri::Result<()> {
    let cursor = app.cursor_position()?;
    let monitor = app
        .monitor_from_point(cursor.x, cursor.y)?
        .or(app.primary_monitor()?);
    let Some(monitor) = monitor else {
        return Ok(());
    };

    let window_size = quick_capture.outer_size()?;
    let work_area = monitor.work_area();
    let max_x =
        work_area.position.x + work_area.size.width.saturating_sub(window_size.width) as i32;
    let max_y =
        work_area.position.y + work_area.size.height.saturating_sub(window_size.height) as i32;
    let x = clamp_to_work_area(
        cursor.x as i32 - window_size.width as i32 / 2,
        work_area.position.x,
        max_x,
    );
    let y = clamp_to_work_area(
        cursor.y as i32 - window_size.height as i32 / 2,
        work_area.position.y,
        max_y,
    );

    quick_capture.set_position(PhysicalPosition::new(x, y))
}

fn monitor_for_tray<R: Runtime>(
    app: &AppHandle<R>,
    tray_rect: Rect,
) -> tauri::Result<Option<tauri::Monitor>> {
    let tray_position = match tray_rect.position {
        Position::Physical(position) => position,
        Position::Logical(position) => {
            let scale_factor = app
                .primary_monitor()?
                .map(|monitor| monitor.scale_factor())
                .unwrap_or(1.0);
            position.to_physical::<i32>(scale_factor)
        }
    };

    Ok(app
        .monitor_from_point(tray_position.x as f64, tray_position.y as f64)?
        .or(app.primary_monitor()?))
}

fn clamp_to_work_area(value: i32, min: i32, max: i32) -> i32 {
    if max <= min {
        min
    } else {
        value.clamp(min, max)
    }
}

#[cfg(target_os = "macos")]
fn configure_macos_popover<R: Runtime>(popover: &WebviewWindow<R>) -> tauri::Result<()> {
    let panel = popover.to_panel::<SlatePopoverPanel<R>>()?;
    panel.set_level(PanelLevel::Floating.value());
    panel.set_style_mask(StyleMask::empty().nonactivating_panel().into());
    panel.set_collection_behavior(
        CollectionBehavior::new()
            .full_screen_auxiliary()
            .can_join_all_spaces()
            .into(),
    );
    panel.set_hides_on_deactivate(false);

    Ok(())
}

#[cfg(target_os = "macos")]
fn configure_macos_quick_capture<R: Runtime>(
    quick_capture: &WebviewWindow<R>,
) -> tauri::Result<()> {
    let panel = quick_capture.to_panel::<SlatePopoverPanel<R>>()?;
    quick_capture.set_always_on_top(true)?;
    panel.set_level(PanelLevel::ScreenSaver.value());
    panel.set_floating_panel(true);
    panel.set_becomes_key_only_if_needed(false);
    panel.set_style_mask(StyleMask::empty().into());
    let behavior = CollectionBehavior::new()
        .full_screen_auxiliary()
        .can_join_all_spaces()
        .transient()
        .ignores_cycle()
        .value()
        | NSWindowCollectionBehavior::CanJoinAllApplications;
    panel.set_collection_behavior(behavior);
    panel.set_hides_on_deactivate(false);

    Ok(())
}

#[cfg(target_os = "macos")]
fn show_popover<R: Runtime>(app: &AppHandle<R>, _: &WebviewWindow<R>) -> tauri::Result<()> {
    let panel = app
        .get_webview_panel(POPOVER_WINDOW_LABEL)
        .map_err(|_| missing_window_error(POPOVER_WINDOW_LABEL))?;
    panel.show_and_make_key();
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn configure_macos_popover<R: Runtime>(_: &WebviewWindow<R>) -> tauri::Result<()> {
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn show_popover<R: Runtime>(_: &AppHandle<R>, popover: &WebviewWindow<R>) -> tauri::Result<()> {
    popover.show()?;
    popover.set_focus()
}

#[cfg(not(target_os = "macos"))]
fn configure_macos_quick_capture<R: Runtime>(_: &WebviewWindow<R>) -> tauri::Result<()> {
    Ok(())
}

fn menu_bar_icon() -> Image<'static> {
    const SIZE: u32 = 18;
    let mut pixels = vec![0; (SIZE * SIZE * 4) as usize];

    for y in 3..15 {
        for x in 3..15 {
            let is_stroke =
                (y == 3 || y == 8 || y == 14) || (x == 3 && y < 9) || (x == 14 && y > 7);
            if !is_stroke {
                continue;
            }

            let index = ((y * SIZE + x) * 4) as usize;
            pixels[index..index + 4].copy_from_slice(&[0, 0, 0, 255]);
        }
    }

    Image::new_owned(pixels, SIZE, SIZE)
}
