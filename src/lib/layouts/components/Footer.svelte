<script lang="ts">
    import {Container, Row, Col} from '@sveltestrap/sveltestrap';
    import Icon from "@iconify/svelte";
    import {developedBy, developedByLink, currentYear} from "$lib/helpers/constants";
</script>

<footer class="footer">
    <Container fluid>
        <Row>
            <Col class="text-center">
                {currentYear}
                &copy; tkraf

            </Col>
        </Row>
    </Container>
</footer>