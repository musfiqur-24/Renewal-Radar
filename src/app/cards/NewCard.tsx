import React from 'react';
import { Box, Divider, ErrorState, Flex, LoadingSpinner, Tag, Text, hubspot, useExtensionContext } from '@hubspot/ui-extensions';
import { useAssociations } from '@hubspot/ui-extensions/crm';

hubspot.extend<'crm.record.tab'>(() => <RenewalRadar />);

const RenewalRadar = () => {
  const { extension } = useExtensionContext<'crm.record.tab'>();
  const appId = extension?.appId;
  const prefix = `a${appId}_`;
  
  const { results, error, isLoading } = useAssociations({
    toObjectType: '1-12815455',
    properties: ['score', 'risk_level', 'trend', 'open_tickets', 'overdue_deals', 'engagement_count', 'last_calculated'].map((name) => `${prefix}${name}`),
    pageLength: 1,
  });

  if (isLoading) return <Flex direction="row" justify="center" align="center" gap="small"><LoadingSpinner label="Loading renewal data" showLabel={false} /><Text>Loading renewal data...</Text></Flex>;
  if (error) return <ErrorState title="Unable to load renewal data"><Text>{error.message}</Text></ErrorState>;

  // Use the fetched App Object data, or default values if the company doesn't have an associated score object yet
  const data = results?.[0]?.properties || {};
  
  // Safely get a value from the App Object data, falling back to defaults
  const value = (name: string, fallback: string | number = 0) => {
    const rawValue = data[`${prefix}${name}`];
    return rawValue !== undefined && rawValue !== null ? rawValue : fallback;
  };

  const score = value('score', 0);
  const riskLevel = value('risk_level', 'healthy');
  const trend = value('trend', 'flat');
  const riskVariant = riskLevel === 'at_risk' ? 'error' : riskLevel === 'watch' ? 'warning' : 'success';

  return (
    <Box>
      <Flex direction="column" gap="medium">
        <Flex direction="row" justify="between" align="center">
          <Text format={{ fontWeight: 'bold' }}>Renewal Radar</Text>
          <Tag variant={riskVariant}>{riskLevel === 'at_risk' ? 'At Risk' : riskLevel === 'watch' ? 'Watch' : 'Healthy'}</Tag>
        </Flex>
        <Divider />
        <Flex direction="row" justify="between">
          <Text>Risk Score</Text>
          <Text format={{ fontWeight: 'bold' }}>{score}/100</Text>
        </Flex>
        <Text>Trend: {trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable'}</Text>
        <Divider />
        <Text format={{ fontWeight: 'bold' }}>Risk Factors</Text>
        <Flex direction="row" justify="between">
          <Text>Open Tickets</Text>
          <Text>{value('open_tickets', 0)}</Text>
        </Flex>
        <Flex direction="row" justify="between">
          <Text>Overdue Deals</Text>
          <Text>{value('overdue_deals', 0)}</Text>
        </Flex>
        <Flex direction="row" justify="between">
          <Text>Engagements (90 Days)</Text>
          <Text>{value('engagement_count', 0)}</Text>
        </Flex>
      </Flex>
    </Box>
  );
};

export default RenewalRadar;
