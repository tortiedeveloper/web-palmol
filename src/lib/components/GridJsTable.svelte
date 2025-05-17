<script lang="ts">
    import {Grid} from "gridjs";
    import {onMount} from "svelte";

    export let id: string
    export let options: object

    onMount(() => {
        const ele = document.getElementById(id)

        if (ele) new Grid(options).render(ele);
    })
</script>

<div id={id}></div>