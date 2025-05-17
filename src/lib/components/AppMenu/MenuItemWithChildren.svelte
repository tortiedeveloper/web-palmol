<script lang="ts">
    import Icon from '@iconify/svelte';
    import MenuItem from "$lib/components/AppMenu/MenuItem.svelte";
    import MenuItemWithChildren from "$lib/components/AppMenu/MenuItemWithChildren.svelte";
    import type { SubMenus, MenuItemType, LayoutStoreState } from "$lib/types";
    import { Collapse } from "@sveltestrap/sveltestrap";
    import { menuItemActive } from "$lib/components/AppMenu/menuActivation"; 
    import { page } from '$app/stores';
    import { layout } from '$lib/stores/layout';

    export let item: SubMenus['item']; // SubMenus['item'] adalah MenuItemType
    export let className: SubMenus['className'];
    export let subMenuClassName: SubMenus['subMenuClassName'];
    export let linkClassName: SubMenus['linkClassName'] = '';

    // console.log("[MenuItemWithChildren.svelte] Received item prop for key:", item?.key, "with children:", JSON.stringify(item?.children, null, 2));

    const currentRoute = $page.url.pathname;

    // PERBAIKAN: Kirim item.key (string) sebagai argumen pertama ke menuItemActive
    let isOpen = menuItemActive(item.key, currentRoute) ?? false; 

    let currentLeftSideBarSize: LayoutStoreState['leftSideBarSize'];

    $: {
        const layoutValue = $layout;
        if (layoutValue) { // Pastikan layoutValue tidak undefined sebelum mengakses propertinya
            currentLeftSideBarSize = layoutValue.leftSideBarSize;
        }
    }
</script>

<li class="{className}">
    <!-- svelte-ignore a11y-missing-attribute -->
    <a role="button" on:click={() => isOpen = !isOpen}
       class={`nav-link menu-arrow ${isOpen && 'active'} ${linkClassName || ''}`} 
       tabindex="0" 
       aria-expanded={isOpen}
       aria-controls="submenu-{item.key}"
       on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') isOpen = !isOpen; }}> 

        {#if item.icon}
          <span class="nav-icon">
            <Icon icon={item.icon}/>
          </span>
        {/if}
        <span class="nav-text">{item.label}</span>
        {#if item.badge}
            <span class="badge badge-pill text-end bg-{item.badge.variant}">{item.badge.text}</span>
        {/if}
    </a>
    <Collapse {isOpen} id="submenu-{item.key}" class={currentLeftSideBarSize === 'sm-hover' || currentLeftSideBarSize === 'condensed' ? 'collapse':''} >
        <ul class="{subMenuClassName}">
            {#each item.children || [] as child (child.key)}
                {#if child.children && child.children.length > 0}
                    <MenuItemWithChildren 
                        item={child} 
                        className="sub-nav-item"
                        subMenuClassName="nav sub-navbar-nav"
                        linkClassName="nav-link"
                    />
                {:else}
                    <MenuItem 
                        item={child} 
                        className="sub-nav-item" 
                        linkClassName="sub-nav-link"
                    />
                {/if}
            {/each}
        </ul>
    </Collapse>
</li>