import {
    Outlet,
    ScrollRestoration,
    createRootRoute,
} from "@tanstack/react-router";
import { Meta, Scripts } from "@tanstack/start";
import type { ReactNode } from "react";

export const Route = createRootRoute({
    head: () => ({
          meta: [
            { charSet: "utf-8" },
            { name: "viewport", content: "width=device-width, initial-scale=1" },
            { title: "Book Your Stay | Hop Farm Beach - Forest Cabin in Sweden" },
            {
                      name: "description",
                      content: "Book your digital detox escape at Hop Farm Beach. A secluded forest cabin on Sweden's Baltic coast with private sauna, no WiFi, and pristine beach access. Sleeps 4."
            },
            { name: "robots", content: "index, follow" },
            { property: "og:title", content: "Book Your Stay | Hop Farm Beach" },
            { property: "og:description", content: "A secluded forest cabin on Sweden's Baltic coast. Private sauna, no WiFi, pristine beach. The perfect digital detox." },
            { property: "og:type", content: "website" },
            { property: "og:url", content: "https://book.hopfarmbeach.com" },
            { property: "og:image", content: "https://hopfarmbeach.com/images/hop-farm-beach-cabin-hero.jpg" },
                ],
          links: [
            { rel: "icon", href: "/favicon.ico" },
            { rel: "canonical", href: "https://book.hopfarmbeach.com" },
                ],
    }),
    component: RootComponent,
});

function RootComponent() {
    return (
          <RootDocument>
                <Outlet />
          </RootDocument>RootDocument>
        );
}

function RootDocument({ children }: { children: ReactNode }) {
    return (
          <html lang="en">
                <head>
                        <Meta />
                        <script
                                    type="application/ld+json"
                                    dangerouslySetInnerHTML={{
                                                  __html: JSON.stringify({
                                                                  "@context": "https://schema.org",
                                                                  "@type": "LodgingBusiness",
                                                                  "name": "Hop Farm Beach",
                                                                  "description": "A secluded forest cabin on Sweden's Baltic coast with private sauna, no WiFi, and pristine beach access.",
                                                                  "url": "https://hopfarmbeach.com",
                                                                  "telephone": "",
                                                                  "email": "info@hopfarmbeach.com",
                                                                  "address": {
                                                                                    "@type": "PostalAddress",
                                                                                    "streetAddress": "Humlegårdsstrand",
                                                                                    "addressLocality": "Söderhamn",
                                                                                    "addressRegion": "Gävleborg",
                                                                                    "postalCode": "826 93",
                                                                                    "addressCountry": "SE"
                                                                  },
                                                                  "geo": {
                                                                                    "@type": "GeoCoordinates",
                                                                                    "latitude": "61.2769444",
                                                                                    "longitude": "17.1138889"
                                                                  },
                                                                  "image": "https://hopfarmbeach.com/images/hop-farm-beach-cabin-hero.jpg",
                                                                  "priceRange": "$$",
                                                                  "amenityFeature": [
                                                                    { "@type": "LocationFeatureSpecification", "name": "Sauna", "value": true },
                                                                    { "@type": "LocationFeatureSpecification", "name": "Beach Access", "value": true },
                                                                    { "@type": "LocationFeatureSpecification", "name": "Kitchenette", "value": true },
                                                                    { "@type": "LocationFeatureSpecification", "name": "Heated Floors", "value": true },
                                                                    { "@type": "LocationFeatureSpecification", "name": "Air Conditioning", "value": true },
                                                                    { "@type": "LocationFeatureSpecification", "name": "Private Deck", "value": true }
                                                                                  ],
                                                                  "numberOfRooms": 1,
                                                                  "petsAllowed": false,
                                                                  "checkinTime": "15:00",
                                                                  "checkoutTime": "11:00",
                                                                  "potentialAction": {
                                                                                    "@type": "ReserveAction",
                                                                                    "target": {
                                                                                                        "@type": "EntryPoint",
                                                                                                        "urlTemplate": "https://book.hopfarmbeach.com",
                                                                                                        "actionPlatform": [
                                                                                                                              "http://schema.org/DesktopWebPlatform",
                                                                                                                              "http://schema.org/MobileWebPlatform"
                                                                                                                            ]
                                                                                      },
                                                                                    "result": {
                                                                                                        "@type": "LodgingReservation",
                                                                                                        "name": "Book Hop Farm Beach Cabin"
                                                                                      }
                                                                  }
                                                  })
                                    }}
                                  />
                </head>head>
                <body className="bg-cream text-stone-900 antialiased">
                  {children}
                        <ScrollRestoration />
                        <Scripts />
                </body>body>
          </html>html>
        );
}</RootDocument>
