<script lang="ts">
    import Inputmask from "inputmask";
    import {onMount} from "svelte";
    import {Input} from "@sveltestrap/sveltestrap";

    export let id: string
    export let mask: string
    export let options: object = {}

    onMount(() => {
        new Inputmask({"mask": mask, ...options}).mask(`#${id}`)
    })
</script>

<Input type="text" id={id}/>