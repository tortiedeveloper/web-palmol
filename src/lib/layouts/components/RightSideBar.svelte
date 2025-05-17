<script lang="ts">
    import {Button, Offcanvas, Row, Col, Input, OffcanvasBody} from '@sveltestrap/sveltestrap';
    import {
        layout,
        resetLayout,
        setLeftSideBarColor,
        setLeftSideBarSize,
        setTheme,
        setTopBarColor
    } from "$lib/stores/layout";

    export let isRightSideBarOpen: boolean


    let currentTheme: 'light' | 'dark';
    let currentTopBarColor: 'light' | 'dark';
    let currentLeftSideBarColor: 'light' | 'dark';
    let currentLeftSideBarSize: 'sm-hover-active' | 'sm-hover' | 'hidden' | 'condensed' | 'default';

    layout.subscribe(value => {
        currentTheme = value.theme;
        currentTopBarColor = value.topBarColor
        currentLeftSideBarColor = value.leftSideBarColor
        currentLeftSideBarSize = value.leftSideBarSize
    });

</script>

<div>
    <Offcanvas placement="end" isOpen={isRightSideBarOpen} toggle={() => isRightSideBarOpen = !isRightSideBarOpen}
               class="border-bottom" header="Theme Settings"
               id="right-sidebar">


        <OffcanvasBody class="p-0">
            <div data-simplebar>
                <div class="settings-bar">
                    <div>
                        <h5 class="mb-3 font-16 fw-semibold">Color Scheme</h5>
                        <Input class="mb-2" type="radio" name="theme" value="light" label="Light"
                               bind:group={currentTheme}
                               on:change={() => setTheme('light')}/>
                        <Input class="mb-2" type="radio" name="theme" value="dark" label="Dark"
                               bind:group={currentTheme}
                               on:change={() => setTheme('dark')}/>
                    </div>

                    <div>
                        <h5 class="my-3 font-16 fw-semibold">Topbar Color</h5>
                        <Input class="mb-2" type="radio" name="topBarColor" value="light" label="Light"
                               bind:group={currentTopBarColor}
                               on:change={() => setTopBarColor('light')}/>
                        <Input class="mb-2" type="radio" name="topBarColor" value="dark" label="Dark"
                               bind:group={currentTopBarColor}
                               on:change={() => setTopBarColor('dark')}/>
                    </div>

                    <div>
                        <h5 class="my-3 font-16 fw-semibold">Menu Color</h5>
                        <Input class="mb-2" type="radio" name="leftSideBarColor" value="light" label="Light"
                               bind:group={currentLeftSideBarColor}
                               on:change={() => setLeftSideBarColor('light')}/>
                        <Input class="mb-2" type="radio" name="leftSideBarColor" value="dark" label="Dark"
                               bind:group={currentLeftSideBarColor}
                               on:change={() => setLeftSideBarColor('dark')}/>
                    </div>

                    <div>
                        <h5 class="my-3 font-16 fw-semibold">Sidebar Size</h5>

                        <Input class="mb-2" type="radio" name="leftSideBarSize" value="default" label="Default"
                               bind:group={currentLeftSideBarSize}
                               on:change={() => setLeftSideBarSize('default')}/>
                        <Input class="mb-2" type="radio" name="leftSideBarSize" value="condensed" label="Condensed"
                               bind:group={currentLeftSideBarSize}
                               on:change={() => setLeftSideBarSize('condensed')}/>
                        <Input class="mb-2" type="radio" name="leftSideBarSize" value="hidden" label="Hidden"
                               bind:group={currentLeftSideBarSize}
                               on:change={() => setLeftSideBarSize('hidden')}/>
                        <Input class="mb-2" type="radio" name="leftSideBarSize" value="sm-hover-active"
                               label="Small Hover Active"
                               bind:group={currentLeftSideBarSize}
                               on:change={() => setLeftSideBarSize('sm-hover-active')}/>
                        <Input class="mb-2" type="radio" name="leftSideBarSize" value="sm-hover" label="Small Hover"
                               bind:group={currentLeftSideBarSize}
                               on:change={() => setLeftSideBarSize('sm-hover')}/>
                    </div>
                </div>
                <div class="border-top p-3 text-center mt-3">
                    <Row>
                        <Col>
                            <Button color="danger" class="w-100" on:click={resetLayout}>
                                Reset
                            </Button>
                        </Col>
                    </Row>
                </div>
            </div>
        </OffcanvasBody>


    </Offcanvas>
</div>