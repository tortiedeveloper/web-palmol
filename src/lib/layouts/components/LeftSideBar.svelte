<script lang="ts">
    import LogoBox from "$lib/components/LogoBox.svelte";
    import AppMenu from "$lib/components/AppMenu/index.svelte";
    import Icon from "@iconify/svelte";
    import 'simplebar';
    // PERBAIKAN 1: Gunakan 'layout' sesuai impor awal Anda
    import { layout, setLeftSideBarSize } from "$lib/stores/layout"; 
    import { onMount, onDestroy } from "svelte"; // onDestroy untuk cleanup
    import type { MenuItemType, LayoutStoreState } from '$lib/types'; // Impor LayoutStoreState

    export let menuItems: MenuItemType[];

    // PERBAIKAN 1 & 2: currentLeftSideBarSize tipenya dari LayoutStoreState
    let currentLeftSideBarSize: LayoutStoreState['leftSideBarSize'];

    // PERBAIKAN 2: Beri tipe pada 'value'
    const unsubscribeLayout = layout.subscribe((value: LayoutStoreState) => { 
        currentLeftSideBarSize = value.leftSideBarSize;
    });

    const toggleMenuSize = () => {
        if (currentLeftSideBarSize === 'sm-hover-active') return setLeftSideBarSize('sm-hover');
        return setLeftSideBarSize('sm-hover-active');
    };

    const adjustLayout = () => {
        if (typeof window === 'undefined') return; // Guard clause untuk SSR
        
        // Untuk mendapatkan nilai terkini dari store jika 'layout' adalah writable store
        // Anda mungkin perlu cara untuk mendapatkan nilai saat ini jika 'layout.get()' tidak ada
        // atau cukup andalkan 'currentLeftSideBarSize' yang sudah disubscribe.
        // Namun, saat resize dari kondisi 'hidden', kita mungkin ingin kembali ke default atau state sebelumnya.
        // Untuk simplebar, kita asumsikan currentLeftSideBarSize cukup.
        
        if(window.innerWidth <= 1140){
            setLeftSideBarSize('hidden');
        } else {
            // Jika sebelumnya hidden karena resize, kembalikan ke default atau state yang diingat
            // Jika tidak, biarkan seperti currentLeftSideBarSize
            if (currentLeftSideBarSize === 'hidden') {
                 setLeftSideBarSize('default'); // Atau 'sm-hover-active' sesuai default Anda
            } else {
                // Tidak perlu set lagi jika tidak berubah dari hidden
            }
        }
    };

    onMount(() => {
        adjustLayout(); // Panggil sekali saat mount
        window.addEventListener('resize', adjustLayout);
        
        return () => {
            window.removeEventListener('resize', adjustLayout);
            if (unsubscribeLayout) {
                unsubscribeLayout();
            }
        };
    });
</script>

<div class="main-nav">
    <LogoBox/>
    <button type="button" class="button-sm-hover" on:click={toggleMenuSize} aria-label="Toggle Menu Size">
        <Icon icon="iconamoon:arrow-left-4-square-duotone"
              class="button-sm-hover-icon fs-10 mt-2 me-1" style="height: 24px; width: 24px"/>
    </button>
    <div data-simplebar class="scrollbar">
        <AppMenu {menuItems}/>
    </div>
</div>