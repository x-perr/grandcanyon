# Active Projects Missing Coordinates

**Generated**: 2026-03-03
**Total**: 34 projects (out of 113 active)
**Geocoded**: 79 projects (70%)

---

## Not Found by Geocoder (6)

These have addresses but Nominatim couldn't locate them. May need city added or address correction.

| Code | Address | City | Suggested Fix |
|------|---------|------|---------------|
| 8874 | 5555, rue William Price | - | Add city (Chicoutimi?) |
| 8890 | 350, Av St-Denis | - | Add city (Montreal?) |
| 8933 | 2285, Francis-Hugues | - | Add city (Laval?) |
| 8943 | 5555, rue Trent | - | Add city (Brossard?) |
| 8960 | 1070, Lumen | - | Add city or full address |
| 8961 | 3610, boul. Cote Vertu Ouest | - | Add city (Saint-Laurent?) |

---

## No Address (28)

These projects have no address stored. Add address via Admin > Projects.

| Code | Name |
|------|------|
| 0001 | Projet générique |
| 8756 | Delson Centre Sportif |
| 8803 | Hilton Laval |
| 8820 | College Montmorency |
| 8833 | Oméga |
| 8840 | École Jacques Leber |
| 8858 | Demers Beaulne |
| 8861 | Lib Hymus |
| 8870 | Fery Beauté Spa |
| 8871 | Tourisme Montréal - 24e étage |
| 8872 | Tourisme Montréal - Temps + Materiel |
| 8886 | Pizza Pizza 334 |
| 8892 | Asha Yoga |
| 8893 | Station Go, Complex Johnson |
| 8896 | Energir |
| 8897 | LC Soudure Inc. |
| 8901 | Hopital Ste-Justine |
| 8906 | Fitness, 572 Arthur-Sauvé |
| 8908 | Reine-Marie College |
| 8914 | École Nesbitt |
| 8917 | SVI |
| 8922 | Projet Gauthier |
| 8927 | Kia Vimont Laval |
| 8935 | ABB DORVAL - Démolition Mur et Ragreage |
| 8937 | Lavery |
| 8952 | Hopital Général Juif |
| 8963 | Royalton Condo |
| 8964 | MDA |

---

## How to Fix

1. **Add addresses** via Admin > Projects > Edit
2. **Re-run geocoding** with service role key:
   ```bash
   # Add to .env.local
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # Run script
   node --env-file=.env.local scripts/migration/geocode-projects.js
   ```

3. **Get service role key** from Supabase Dashboard:
   - Project Settings > API > service_role key (secret)
