# Questionnaire and application inputs

## Address search setup

This feature uses Geoapify Address Autocomplete, restricted to Australia. The free plan currently includes 3,000 credits/day and permits commercial use with attribution. One autocomplete request consumes one credit. Pricing and requirements: https://www.geoapify.com/pricing/ and https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/.

1. Register at https://myprojects.geoapify.com/ and create a project.
2. Copy its API key into `.env.local`:

   ```dotenv
   GEOAPIFY_API_KEY=your-key
   ```

3. Add the same environment variable in Vercel for the intended environments, then redeploy. Restart the local development server after editing `.env.local`.
4. Keep the key server-side; do not prefix it with `NEXT_PUBLIC_`. Calls originate from the server, so a browser-referrer restriction is not suitable for this integration. Configure provider quotas and monitor usage. The application's per-instance rate limit is best effort, not a global spending cap.

No key is checked into the repository. Street address search itself requires no migration. The purchase-location enhancement adds nullable suburb and state columns; see the migration section below before testing application persistence.

## Address behaviour

- Applies to the refinance property address, current home address, workplace address and previous residential addresses.
- Search starts after four characters and a 400 ms pause. Changing the query cancels obsolete browser requests.
- Only Australian results with a street, house number and postcode are selectable; suburb-only results are excluded.
- Selecting a suggestion commits the canonical full address. The server issues a signed selection receipt and checks it when saving a new or changed address.
- Editing a selected address clears the selection. Users must select again or explicitly choose manual entry.
- After a search with missing results, an incorrect result set, or an unavailable service, the user can choose manual entry. Include unit number, street, suburb, state and postcode. Unit addresses or new developments absent from the data should use this fallback.
- Missing configuration leaves manual entry available after an attempted search. The UI never claims such an address was validated by the provider.
- Lookup confirms only that the address was suggested by Geoapify; it does not verify ownership, residency or lending eligibility.
- Previously saved continuation addresses can be retained. New or changed addresses require a selection or explicit manual entry, including on draft saves.
- The existing address string columns remain canonical. Questionnaire receipts are used for validation only; continuation receipts and manual-entry reasons are retained in the existing details JSON.
- API requests are not cached, and provider URLs or customer queries are not logged by the search route.

## Purchase postcode and suburb

- The purchase questionnaire searches by postcode or suburb using the same Geoapify key and endpoint (`kind: LOCALITY`). Search starts at two characters.
- Suggestions identify a complete postcode/suburb/state combination. A shared postcode can appear with different suburbs; selecting one commits all three values.
- Only Australian results with a four-digit postcode, identifiable suburb/city and a supported state/territory are selectable. The provider may not enumerate every suburb for a postcode. Missing results use the explicit manual fallback.
- Changing any location requires choosing again or entering all three fields manually. The server verifies a receipt bound to postcode, suburb and state, so replacing only the postcode or suburb invalidates the receipt.
- Manual entry enforces a four-digit postcode (retaining leading zeros), a suburb and a selected state. It does not certify that the postcode/suburb association is geographically correct; the broker must confirm it.
- The existing `property_postcode` field is retained. New `property_suburb` and `property_state` fields are shown to the administrator and included in the recommendation input snapshot; the recommendation ranking rules are unchanged.

## Database migration

Migration source: `prisma/migrations/20261026000000_add_property_locality/migration.sql`.
It creates `AustralianState` and adds nullable `property_suburb` and `property_state` columns to `applications`. Existing application values are retained; missing locations are not guessed or backfilled. The SQL migration is atomic. A database check ensures that new locality fields are either both absent (legacy applications) or include a nonblank suburb, a supported state and a four-digit postcode. Postal codes remain strings so leading zeros are preserved. Suburbs and lender names are not database enums: these are extensible datasets, unlike the small, stable set of Australian state codes. No location index or uniqueness constraint is added because the application does not search by these fields and many applications can share the same location.

Before using this branch against a database, review and apply pending migrations to the intended database:

```sh
pnpm exec prisma migrate deploy
pnpm exec prisma generate
```

Restart development or redeploy afterward. Generating the client alone does not apply a migration. This development task has not applied these changes to the actual database.

## Amounts and lender choice

- Amounts display comma separators while editing, preserve up to two decimal places, and submit unformatted values.
- Annual salary fields accept whole numbers. Alphabetic characters, exponent notation and negative values are rejected by the amount input.
- Current lender is a select using `QUESTIONNAIRE.lenders`. Users can select `Other` when their lender is absent. The shared schema enforces the same list on the server.

## Local checks

```sh
node --import tsx --test tests/questionnaire-inputs.test.ts
pnpm exec tsc --noEmit
```

These checks do not connect to a database. Live search requires a Geoapify key. To check the interaction, search a real Australian address, choose a suggestion, edit it and confirm the selection clears, then test manual fallback. Also check inserting and deleting digits in the middle of a formatted amount.
