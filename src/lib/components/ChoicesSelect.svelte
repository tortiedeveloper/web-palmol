<script lang="ts">
    import {onMount} from "svelte";

    export let id: string
    export let label: string = ''
    export let choiceOptions: object = {}
    export let multiple: boolean = false

    onMount(async () => {
        const Choices = (await import('choices.js')).default;
        new Choices(`#${id}`, {...choiceOptions});
    })
</script>

{#if label.length > 0}
    <label for={id} class="form-label text-muted">{label}</label>
{/if}

<select id={id} class="form-control select2" multiple={multiple}>
    <slot/>
</select>