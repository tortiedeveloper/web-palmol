// src/lib/helpers/menu.ts
import type { MenuItemType, UserSessionData } from '$lib/types';
import { ALL_MENU_ITEMS } from "$lib/assets/data/menu-items";

export const getMenuItems = (userSession?: UserSessionData | null): MenuItemType[] => {
    console.log("[menu.ts] getMenuItems called with userSession:", JSON.stringify(userSession, null, 2));
    if (!userSession) {
        console.log("[menu.ts] getMenuItems: No user session, returning empty menu.");
        return [];
    }

    const filteredMenu: MenuItemType[] = [];

    const generalSection = ALL_MENU_ITEMS.find(item => item.key === 'section-general');
    if (generalSection) {
        filteredMenu.push(generalSection);
    }

    if (userSession.hasGanoAIAccess) {
        const ganoAIMenu = ALL_MENU_ITEMS.find(item => item.key === 'group-ganoai');
        if (ganoAIMenu) {
            console.log("[menu.ts] getMenuItems: Adding GanoAI menu group.");
            filteredMenu.push({
                ...ganoAIMenu,
                children: ganoAIMenu.children || [] 
            });
        } else {
            console.warn("[menu.ts] getMenuItems: GanoAI menu group ('group-ganoai') not found in ALL_MENU_ITEMS.");
        }
    }

    if (userSession.hasRipenessAccess) {
        const sawitHarvestMenu = ALL_MENU_ITEMS.find(item => item.key === 'group-sawitharvest');
        if (sawitHarvestMenu) {
            console.log("[menu.ts] getMenuItems: Adding SawitHarvest menu group.");
            filteredMenu.push({
                ...sawitHarvestMenu,
                children: sawitHarvestMenu.children || []
            });
        } else {
            console.warn("[menu.ts] getMenuItems: SawitHarvest menu group ('group-sawitharvest') not found in ALL_MENU_ITEMS.");
        }

        const palmolMenu = ALL_MENU_ITEMS.find(item => item.key === 'group-palmol');
        if (palmolMenu) {
            console.log("[menu.ts] getMenuItems: Adding Palmol menu group because user has Ripeness access.");
            filteredMenu.push({
                ...palmolMenu,
                children: palmolMenu.children || []
            });
        } else {
            console.warn("[menu.ts] getMenuItems: Palmol menu group ('group-palmol') not found in ALL_MENU_ITEMS.");
        }
    }
    
    // --- BLOK PERBAIKAN ---
    // Jika pengguna memiliki akses ke setidaknya SATU modul (GanoAI atau Ripeness),
    // maka tampilkan menu Support.
    if (userSession.hasGanoAIAccess || userSession.hasRipenessAccess) {
        const supportSection = ALL_MENU_ITEMS.find((item) => item.key === 'section-support');
		if (supportSection) {
			filteredMenu.push(supportSection);
		}
		const chatApp = ALL_MENU_ITEMS.find((item) => item.key === 'app-chat');
		if (chatApp) {
			filteredMenu.push(chatApp);
		}
    }
    // --- AKHIR BLOK PERBAIKAN ---

    console.log("[menu.ts] getMenuItems: Returning filteredMenu:", JSON.stringify(filteredMenu, null, 2));
    return filteredMenu;
};

// --- Sisa fungsi (findAllParent, dll.) tidak perlu diubah ---
export const findAllParent = (menuItems: MenuItemType[], menuItem: MenuItemType): string[] => {
    let parents: string[] = [];
    if (!menuItem || !menuItem.parentKey) {
        return parents;
    }
    const parent = findMenuItem(menuItems, menuItem.parentKey);
    if (parent) {
        parents.push(parent.key);
        if (parent.parentKey) {
            parents = [...parents, ...findAllParent(menuItems, parent)];
        }
    }
    return parents;
};

export const getMenuItemFromURL = (items: MenuItemType | MenuItemType[] | undefined, url: string): MenuItemType | undefined => {
    if (!items) {
        return undefined;
    }
    if (Array.isArray(items)) {
        for (const item of items) {
            if (item) {
                const foundItem = getMenuItemFromURL(item, url);
                if (foundItem) return foundItem;
            }
        }
    } else {
        if (items.url === url) return items;
        if (items.children && Array.isArray(items.children) && items.children.length > 0) { 
            for (const childItem of items.children) {
                if (childItem) {
                    const foundChild = getMenuItemFromURL(childItem, url);
                    if (foundChild) return foundChild;
                }
            }
        }
    }
    return undefined;
};

export const findMenuItem = (
    menuItems: MenuItemType[] | undefined,
    menuItemKey: MenuItemType["key"] | undefined,
): MenuItemType | null => {
    if (menuItems && Array.isArray(menuItems) && menuItemKey) {
        for (const item of menuItems) {
            if (!item) continue;
            if (item.key === menuItemKey) {
                return item;
            }
            if (item.children && Array.isArray(item.children) && item.children.length > 0) { 
                const found = findMenuItem(item.children, menuItemKey);
                if (found) return found;
            }
        }
    }
    return null;
};