<script lang="ts">
    import {Row, Col} from "@sveltestrap/sveltestrap";

    export let title: string
    export let subTitle: string
</script>

<svelte:head>
    <title>{title} | Palmol</title>
</svelte:head>

<Row>
    <Col>
        <div class="page-title-box">
            <h4 class="mb-0 fw-semibold">{ title }</h4>
            <ol class="breadcrumb mb-0">
                <li class="breadcrumb-item">
                    <a href="null">{ subTitle }</a>
                </li>
                <li class="breadcrumb-item active">{ title }</li>
            </ol>
        </div>
    </Col>
</Row>