<script lang="ts">
    import {Container, Row} from "@sveltestrap/sveltestrap";
    import {onDestroy, onMount} from "svelte";

    onMount(() => {
        const body = document.body
        if (body) body.classList.add('authentication-bg')

        return () => {
            if (body) body.classList.remove('authentication-bg')
        }
    })
</script>

<div class="account-pages pt-2 pt-sm-5 pb-4 pb-sm-5">
    <Container>
        <Row class="justify-content-center">
            <slot/>
        </Row>
    </Container>
</div>