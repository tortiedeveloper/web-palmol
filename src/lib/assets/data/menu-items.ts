// src/lib/data/menu-items.ts (atau path tempat Anda mendefinisikan MENU_ITEMS)
import type { MenuItemType } from '$lib/types/menu';

export const ALL_MENU_ITEMS: MenuItemType[] = [
    {
        key: 'section-general', // Key unik
        label: 'GENERAL',
        isTitle: true,
    },
    {
        key: 'group-ganoai', // Key unik untuk grup GanoAI
        icon: 'iconamoon:lab-round-duotone', // Ganti ikon jika perlu agar beda
        label: 'GanoAI',
        isTitle: false,
        children: [
            {
                key: 'dashboard-analytics-gano',
                label: 'Analitik',
                url: '/dashboards/analytics-gano',
                parentKey: 'group-ganoai', // Sesuaikan parentKey
            },
            {
                key: 'app-contacts-gano',
                label: 'Pengguna',
                url: '/apps/contacts-gano',
                parentKey: 'group-ganoai', // Sesuaikan parentKey
            },
            {
                key: 'app-tree-gano',
                label: 'Data Pohon',
                url: '/apps/tree-gano',
                parentKey: 'group-ganoai', // Sesuaikan parentKey
            },
        ],
    },
    {
        key: 'group-sawitharvest', // Key unik untuk grup SawitHarvest
        icon: 'iconamoon:leaf-duotone', // Ganti ikon jika perlu agar beda
        label: 'SawitHarvest',
        isTitle: false,
        children: [
            {
                key: 'dashboard-analytics-ripeness',
                label: 'Analitik',
                url: '/dashboards/analytics-ripeness',
                parentKey: 'group-sawitharvest', // Sesuaikan parentKey
            },
            {
                key: 'app-contacts-ripeness',
                label: 'Pengguna',
                url: '/apps/contacts-ripeness',
                parentKey: 'group-sawitharvest', // Sesuaikan parentKey
            },
            {
                key: 'app-tree-ripeness',
                label: 'Data Pohon',
                url: '/apps/tree-ripeness',
                parentKey: 'group-sawitharvest', // Sesuaikan parentKey
            },
        ],
    },

    {
        key: 'group-palmol', // Key unik untuk grup SawitHarvest
        icon: 'iconamoon:leaf-duotone', // Ganti ikon jika perlu agar beda
        label: 'Palmol',
        isTitle: false,
        children: [
            {
                key: 'dashboard-analytics-palmol',
                label: 'Analitik',
                url: '/dashboards/analytics-palmol',
                parentKey: 'group-palmol', // Sesuaikan parentKey
            },
            {
                key: 'app-pks',
                label: 'PKS',
                url: '/apps/palmol',
                parentKey: 'group-palmol',
            },
            {
                key: 'app-reports-palmol',
                label: 'Reports Palmol',
                url: '/apps/reports-palmol',
                parentKey: 'group-palmol',
            },
            {
                key: 'app-contacts-palmol',
                label: 'Pengguna',
                url: '/apps/contacts-palmol',
                parentKey: 'group-palmol', // Sesuaikan parentKey
            },
        ],
    },
];