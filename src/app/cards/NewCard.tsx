import {
  Box,
  Divider,
  Flex,
  Text,
  hubspot,
  CrmContext,
  ExtensionPointApiActions,
} from '@hubspot/ui-extensions';

interface CrmExtensionProps {
  context: CrmContext;
  actions: ExtensionPointApiActions<'crm.record.tab'>;
}

hubspot.extend<'crm.record.tab'>(({ context, actions }: CrmExtensionProps) => (
  <CrmExtension context={context} actions={actions} />
));

const CrmExtension = ({ context }: CrmExtensionProps) => {
  const companyId = context.crm?.objectId || 'Unknown';

  // Temporary mock data
  const score = 82;
  const riskLevel = 'Healthy';
  const trend = 'Improving';
  const openTickets = 2;
  const overdueDeals = 1;
  const engagements = 15;
  const lastCalculated = '2026-07-09 14:30';

  return (
    <Box>
      <Flex direction="column" gap="small">
        <Text format={{ fontWeight: 'bold' }}>
          Renewal Radar
        </Text>

        <Divider />

        <Text>
          Score: {score}
        </Text>

        <Text>
          Risk Level: {riskLevel}
        </Text>

        <Text>
          Trend: {trend}
        </Text>

        <Divider />

        <Text format={{ fontWeight: 'bold' }}>
          Risk Factors
        </Text>

        <Text>
          Open Tickets: {openTickets}
        </Text>

        <Text>
          Overdue Deals: {overdueDeals}
        </Text>

        <Text>
          Engagements (90 Days): {engagements}
        </Text>

        <Divider />

        <Text>
          Last Calculated: {lastCalculated}
        </Text>

        <Text>
          Company ID: {companyId}
        </Text>
      </Flex>
    </Box>
  );
};

export default CrmExtension;