// Throwaway probe: live eBay metadata for category 119018 (Pro Audio Equipment).
// Fetches RAW condition policies + item aspects so we can see the fields our
// adapter wrappers drop (condition names, descriptors, aspect entry-mode).
import { getEbayProdAppToken } from '../marketplace/token-manager.js';
import { loadEnv } from '../lib/env.js';

const CATEGORY_ID = process.argv[2] ?? '119018';

async function main() {
  loadEnv();
  const token = await getEbayProdAppToken();
  const auth = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  // 1) Condition policies (Sell Metadata API)
  const condFilter = encodeURIComponent(`categoryIds:{${CATEGORY_ID}}`);
  const condRes = await fetch(
    `https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies?filter=${condFilter}`,
    { headers: auth },
  );
  console.log(`\n=== CONDITION POLICIES (HTTP ${condRes.status}) cat ${CATEGORY_ID} ===`);
  const condData = (await condRes.json()) as any;
  const policy = condData?.itemConditionPolicies?.[0];
  if (policy) {
    console.log('itemConditionRequired:', policy.itemConditionRequired);
    console.log('conditions:');
    for (const c of policy.itemConditions ?? []) {
      console.log(`  ${c.conditionId}  ${c.conditionDescription ?? ''}`);
    }
    if (policy.conditionDescriptors?.length) {
      console.log('conditionDescriptors (structured grading):');
      console.log(JSON.stringify(policy.conditionDescriptors, null, 2));
    } else {
      console.log('conditionDescriptors: none');
    }
  } else {
    console.log(JSON.stringify(condData, null, 2));
  }

  // 2) Item aspects (Commerce Taxonomy API)
  const aspRes = await fetch(
    `https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${CATEGORY_ID}`,
    { headers: auth },
  );
  console.log(`\n=== ITEM ASPECTS (HTTP ${aspRes.status}) cat ${CATEGORY_ID} ===`);
  const aspData = (await aspRes.json()) as any;
  const aspects = aspData?.aspects ?? [];
  console.log(`total aspects: ${aspects.length}`);
  for (const a of aspects) {
    const ac = a.aspectConstraint ?? {};
    if (!ac.aspectRequired && ac.aspectUsage !== 'RECOMMENDED') continue; // required + recommended only
    const vals = (a.aspectValues ?? []).map((v: { localizedValue: string }) => v.localizedValue);
    console.log(
      `  ${a.localizedAspectName} | required=${ac.aspectRequired} usage=${ac.aspectUsage} ` +
      `mode=${ac.aspectMode} card=${ac.itemToAspectCardinality} ` +
      `values(${vals.length})=${vals.slice(0, 8).join(', ')}${vals.length > 8 ? ' …' : ''}`,
    );
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
