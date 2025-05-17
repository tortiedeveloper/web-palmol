<script lang="ts">
    import Icon from '@iconify/svelte';
    import { layout, setLeftSideBarSize, setTheme } from "$lib/stores/layout";
    import type { LayoutStoreState, UserSessionData, TopBarProfileItem } from '$lib/types';
    import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from '@sveltestrap/sveltestrap';
    // Hapus goto dan invalidateAll jika kita hanya akan menggunakan window.location
    // import { goto, invalidateAll } from '$app/navigation'; 
    import { onDestroy, onMount } from 'svelte';
    import { toggleDocumentAttribute } from "$lib/helpers/layout";

    export let userSession: UserSessionData | undefined = undefined;

    // ... (sisa kode <script> Anda yang tidak berubah: currentTheme, currentLeftSideBarSize, subscribe, toggleThemeHandler, toggleMainLeftSideBarHandler, showBackdrop) ...
    let currentTheme: LayoutStoreState['theme'];
    let currentLeftSideBarSize: LayoutStoreState['leftSideBarSize'];

    const unsubscribeLayout = layout.subscribe((value: LayoutStoreState) => {
        currentTheme = value.theme;
        currentLeftSideBarSize = value.leftSideBarSize;
    });
    
    const toggleThemeHandler = () => {
        setTheme(currentTheme === 'light' ? 'dark' : 'light');
    };

    const toggleMainLeftSideBarHandler = () => {
        if (typeof window !== 'undefined') {
            if (window.innerWidth <= 1140) {
                toggleDocumentAttribute('class', 'sidebar-enable');
                showBackdrop();
            } else {
                const newSize = (currentLeftSideBarSize === 'default' || currentLeftSideBarSize === 'sm-hover-active') ? 'condensed' : 'default';
                setLeftSideBarSize(newSize);
            }
        }
    };

    const showBackdrop = () => {
        if (typeof window === 'undefined' || !document.body) return;
        const existingBackdrop = document.querySelector('.offcanvas-backdrop');
        if (existingBackdrop) return;
        let backdrop = document.createElement('div');
        backdrop.classList.add("offcanvas-backdrop", "fade", "show");
        document.body.appendChild(backdrop);
        document.body.style.overflow = "hidden";
        const closeBackdropListener = () => {
            toggleDocumentAttribute('class', '');
            if (document.body.contains(backdrop)) {
                document.body.removeChild(backdrop);
            }
            document.body.style.overflow = '';
            backdrop.removeEventListener('click', closeBackdropListener);
        };
        backdrop.addEventListener('click', closeBackdropListener);
    };


    async function handleLogout() {
        try {
            const response = await fetch('/auth/logout', { 
                method: 'POST',
            });

            if (response.ok) {
                const result = await response.json(); // Baca respons JSON dari server
                if (result.success) {
                    console.log("Logout dari server dikonfirmasi, navigasi ke /auth/sign-in via window.location.assign");
                    // Cara paling pasti untuk navigasi penuh dan membersihkan state klien
                    window.location.assign('/auth/sign-in'); 
                } else {
                    console.error("Server mengindikasikan logout gagal:", result.message);
                    alert("Gagal melakukan logout. Silakan coba lagi.");
                }
            } else {
                console.error("Gagal menghubungi endpoint logout:", response.status, response.statusText);
                alert("Gagal melakukan logout. Koneksi bermasalah.");
            }
        } catch (error) {
            console.error("Error saat fetch ke /auth/logout:", error);
            alert("Terjadi kesalahan saat logout. Silakan coba lagi.");
        }
    }

    let profileMenuItems: TopBarProfileItem[] = [];
    let hasNonHeaderProfileItems = false;

    $: if (userSession && userSession.email) {
        profileMenuItems = [
            { key: 'welcome', label: `Halo, ${userSession.email.split('@')[0]}!`, isHeader: true },
        ];
        hasNonHeaderProfileItems = profileMenuItems.some((p: TopBarProfileItem) => !p.isHeader);
    } else {
        profileMenuItems = [];
        hasNonHeaderProfileItems = false;
    }

    onDestroy(() => {
        if (unsubscribeLayout) unsubscribeLayout();
    });
</script>

<header class="topbar">
    <div class="container-xxl">
        <div class="navbar-header d-flex align-items-center">
            <div class="d-flex align-items-center">
                <div class="topbar-item">
                    <button type="button" class="button-toggle-menu" on:click={toggleMainLeftSideBarHandler} aria-label="Toggle Menu">
                        <Icon icon="iconamoon:menu-burger-horizontal" class="fs-22 align-middle"/>
                    </button>
                </div>
                
            </div>

            <div class="d-flex align-items-center gap-2 ms-auto">  
                <div class="topbar-item">  
                    <button type="button" class="topbar-button" on:click={toggleThemeHandler} aria-label="Toggle Theme">
                        <Icon icon={currentTheme === 'dark' ? 'iconamoon:mode-light-duotone' : 'iconamoon:mode-dark-duotone'} class="fs-24 align-middle"/>
                    </button>
                </div>
                
                {#if userSession}
                    <Dropdown nav class="topbar-item" inNavbar>
                        <DropdownToggle nav caret class="topbar-button p-0 d-flex align-items-center">
                            <span class="d-none d-xl-inline-block fw-medium">{userSession.email.split('@')[0]}</span>
                        </DropdownToggle>
                        <DropdownMenu end class="dropdown-menu-animated py-2">
                            {#each profileMenuItems as item (item.key)}
                                {#if item.isHeader}
                                    <h6 class="dropdown-header fs-13 text-muted text-uppercase px-3 py-1 mb-0">{item.label}</h6>
                                {:else}
                                    <a class="dropdown-item d-flex align-items-center" href={item.url || '#'}>
                                        {#if item.icon}
                                            <Icon icon={item.icon} class="fs-18 me-2 text-muted"/>
                                        {/if}
                                        <span class="align-middle">{item.label}</span>
                                    </a>
                                {/if}
                            {/each}
                            {#if hasNonHeaderProfileItems} 
                                <DropdownItem divider class="my-1"/>
                            {/if}
                            <button type="button" class="dropdown-item d-flex align-items-center text-danger" on:click|preventDefault={handleLogout}>
                                <Icon icon="mdi:logout-variant" class="fs-18 me-2"/>
                                <span class="align-middle">Logout</span>
                            </button>
                        </DropdownMenu>
                    </Dropdown>
                {:else}
                    <div class="topbar-item">
                         <a href="/auth/sign-in" class="btn btn-sm btn-primary px-3">Login</a>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</header>