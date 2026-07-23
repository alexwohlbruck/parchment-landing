import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Button from "./Button.vue";
import { APP_URL } from "@/lib/links";

describe("Button", () => {
  it("renders an anchor when given an href", () => {
    const wrapper = mount(Button, {
      props: { href: APP_URL },
      slots: { default: "Launch app" },
    });

    const anchor = wrapper.find("a");
    expect(anchor.exists()).toBe(true);
    expect(anchor.attributes("href")).toBe(APP_URL);
  });

  it("renders a button element when no href is given", () => {
    const wrapper = mount(Button, {
      props: { type: "submit" },
      slots: { default: "Submit" },
    });

    expect(wrapper.find("button").exists()).toBe(true);
    expect(wrapper.find("a").exists()).toBe(false);
  });

  it("points the launch link at the map app", () => {
    // The "Launch app" CTA must send visitors to the live map app, not the
    // marketing site. Regression guard for the launch-button bug.
    expect(APP_URL).toBe("https://map.parchment.app");
  });
});
