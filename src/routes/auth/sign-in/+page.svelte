<script lang="ts">
    import AuthLayout from "$lib/layouts/AuthLayout.svelte";
    import LogoBox from "$lib/components/LogoBox.svelte";
    import {Button, Card, CardBody, Col, Form, Input, Row} from "@sveltestrap/sveltestrap";
    import type {Actions} from "@sveltejs/kit";

    // const signInImg = '/images/sign-in.svg'; // Dihilangkan karena gambar tidak digunakan
    export let form: Actions;
</script>

<AuthLayout>
    <Col xl="5" md="7" sm="9">  
        <Card class="auth-card">
            <CardBody class="p-0">
               
                <div class="p-4">  
                    <div class="mx-auto mb-4 text-center auth-logo">
                        <LogoBox/>
                    </div>

                    <h2 class="fw-bold text-center fs-18">Sign In</h2>
                    <p class="text-muted text-center mt-1 mb-4">Enter your email address and password to access admin panel.</p>

                    <Row class="justify-content-center">
                        
                        <Col md="10" xs="12"> 
                            <Form method="POST" action="?/login" class="authentication-form">
                                {#if form?.invalid}
                                    <div class="mb-2 text-danger">Email and password is required.</div>
                                {/if}
                                {#if form?.credentials}
                                    <div class="mb-2 text-danger">You have entered wrong credentials.</div>
                                {/if}
                                <div class="mb-3">
                                    <label class="form-label" for="example-email">Email</label>
                                    <Input type="email" id="example-email" name="email"
                                           placeholder="Enter your email"/>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label" for="example-password">Password</label>
                                    <Input type="password" id="example-password" name="password"
                                           placeholder="Enter your password"/>
                                </div>

                                <div class="mb-3 text-center d-grid">
                                    <Button color="primary" type="submit"> Sign In</Button>
                                </div>
                            </Form>
                        </Col>
                    </Row>
                </div>
            </CardBody>
        </Card>
    </Col>
</AuthLayout>