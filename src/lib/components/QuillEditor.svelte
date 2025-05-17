<script lang="ts">
    import {onMount} from "svelte";

    export let id: string
    export let height: number = 200
    export let options: object = {}

    onMount(async () => {
        const {default: Quill} = await import("quill");

        new Quill(`#${id}`, options);
    })
</script>

<div id={id} class="editor" style="height: {height}px">
    <slot/>
</div>