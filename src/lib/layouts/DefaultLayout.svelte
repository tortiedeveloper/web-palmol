<script lang="ts">
    import TopBar from "$lib/layouts/components/TopBar.svelte";
    import Footer from "$lib/layouts/components/Footer.svelte";
    import LeftSideBar from "$lib/layouts/components/LeftSideBar.svelte";
    import type { MenuItemType, UserSessionData } from '$lib/types';

    export let data: {
        userSession?: UserSessionData | null;
        menuItemsForLayout: MenuItemType[];
    };

    // Pastikan kita meneruskan undefined jika data.userSession adalah null
    $: userSessionForTopbar = data.userSession === null ? undefined : data.userSession;
</script>

<div class="wrapper"> 
    <TopBar userSession={userSessionForTopbar} /> 
    <LeftSideBar menuItems={data.menuItemsForLayout} /> 
    
    <div class="page-content">
        <div class="container-xxl">
            <slot/>
        </div>
        <Footer/>
    </div>
</div>