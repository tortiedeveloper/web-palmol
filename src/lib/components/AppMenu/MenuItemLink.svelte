<script lang="ts">
    import Icon from '@iconify/svelte';
    import type {SubMenus} from "$lib/types/menu";
    import {page} from '$app/stores';
import {layout} from "$lib/stores/layout";
  import { onMount } from 'svelte';
    const currentRoute = $page.url.pathname
    export let item: SubMenus['item'];
    export let className: SubMenus['className'];

    let isOpen: boolean

    let currentLeftSideBarSize: 'sm-hover-active' | 'sm-hover' | 'hidden' | 'condensed' | 'default';

$: {
    const {leftSideBarSize} = $layout;
    currentLeftSideBarSize = leftSideBarSize;
}

const checkMenuSize = () => {
    if (currentLeftSideBarSize === 'sm-hover' || currentLeftSideBarSize === 'condensed') {
        isOpen = false
    }
}

checkMenuSize()
onMount(() => {
    checkMenuSize()
})

</script>

<a href={item.url} class={`${className} ${currentRoute === item.url && 'active'}`}>
    {#if item.icon}
        <span class="nav-icon">
            <Icon icon={item.icon}/>
        </span>
    {/if}
    <span class="nav-text">{item.label}</span>
    {#if item.badge && isOpen}
        <span class={`font-10 rounded float-end bg-${item.badge.variant}`} style="margin-left: 5px;">
          <span class="badge badge-pill">{item.badge.text}</span>
        </span>
    {/if}
</a>