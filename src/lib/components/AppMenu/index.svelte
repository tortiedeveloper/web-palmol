<script lang="ts">
    import type {MenuItemType} from "$lib/types/menu";
    import MenuItemWithChildren from "$lib/components/AppMenu/MenuItemWithChildren.svelte";
    import MenuItem from "$lib/components/AppMenu/MenuItem.svelte";
    // import {layout} from "$lib/stores/layout"; // Tidak terpakai di sini
    // import {menuItemActive} from "$lib/components/AppMenu/menuActivation"; // Tidak terpakai di sini

    export let menuItems: Array<MenuItemType>;
    console.log("[AppMenu/index.svelte] Received menuItems prop:", JSON.stringify(menuItems, null, 2));
</script>

<ul class="navbar-nav">
    {#each menuItems || [] as item (item.key)}
        {#if item.isTitle}
            <li class="menu-title">{item.label}</li>
        {:else }
            {#if item.children && item.children.length > 0}
                <MenuItemWithChildren 
                    {item} 
                    className='nav-item' 
                    linkClassName='nav-link'
                    subMenuClassName='nav sub-navbar-nav'
                />
            {:else}
                <MenuItem {item} linkClassName="nav-link" className="nav-item"/>
            {/if}
        {/if}
    {/each}
</ul>