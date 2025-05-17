<script lang="ts">
    import {Input, type InputType} from "@sveltestrap/sveltestrap";
    import {onMount} from "svelte";

    export let id: string
    export let label: string = ''
    export let type: InputType = 'text'
    export let choiceOptions: object = {}
    export let value: string = ''

    onMount(async () => {
        const Choices = (await import('choices.js')).default;
        new Choices(`#${id}`, choiceOptions)
    })
</script>

{#if label.length > 0}
    <label for={id} class="form-label text-muted">{label}</label>
{/if}

<Input id={id} type={type} bind:value={value}/>