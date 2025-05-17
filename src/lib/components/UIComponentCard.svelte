<script lang="ts">
    import {Card, CardBody, CardTitle} from "@sveltestrap/sveltestrap";

    export let id: string;
    export let title: string;
    export let caption: string = ''
    export let titleClass: string = ''
</script>

<Card>
    <CardBody>
        <CardTitle class="anchor {titleClass}" id={id}>
            {title}
            <a class="anchor-link" href="#{id}">#</a>
        </CardTitle>
        {#if caption.length > 0}
            <p class="text-muted">{caption}</p>
        {/if}

        <div class="mt-3">
            <slot/>
        </div>

    </CardBody>
</Card>