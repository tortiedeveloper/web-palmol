import type {MenuItemType} from "$lib/types/menu";
import {ALL_MENU_ITEMS} from "$lib/assets/data/menu-items";


let activeMenuItem = {};

const getMatchingMenuItems = (
    data: MenuItemType[],
    currentRoute: string | null | undefined
) => {
    const matchingItems: string[] = [];

    const traverse = (item: MenuItemType) => {
        if (
            item.children &&
            item.children.some((child) => child.url && child.url === currentRoute)
        ) {
            matchingItems.push(item.key); // Add parent's key if a child matches
            if (item.parentKey) {
                matchingItems.push(item.parentKey);
            }
        }

        if (item.children) {
            item.children.forEach((child) => traverse(child));
        }
    };

    data.forEach(traverse);

    return matchingItems;
};

export const menuItemActive = (
    key: string,
    currentRoute: string | null | undefined
) => {
    activeMenuItem = getMatchingMenuItems(ALL_MENU_ITEMS, currentRoute);
    return activeMenuItem && Object.values(activeMenuItem).includes(key);
};