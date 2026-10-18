import {
  Button,
  DataColumn,
  DataTable,
  type DataTableProps,
  Icon,
  Row,
  Text,
  useToast,
} from '@umami/react-zen';
import { type ReactNode, useMemo } from 'react';
import { DateDistance } from '@/components/common/DateDistance';
import { LinkButton } from '@/components/common/LinkButton';
import { SortableLabel } from '@/components/common/SortableLabel';
import { useMessages, useNavigation, useWebsiteListChartsQuery } from '@/components/hooks';
import { Copy, SquarePen } from '@/components/icons';
import { decodePunycodeDomain } from '@/lib/format';
import { WebsiteSparkline } from './WebsiteSparkline';

export interface WebsitesTableProps extends DataTableProps {
  showActions?: boolean;
  renderLink?: (row: any) => ReactNode;
}

export function WebsitesTable({
  showActions,
  renderLink,
  data = [],
  ...props
}: WebsitesTableProps & { data?: any[] }) {
  const { t, labels, messages } = useMessages();
  const { toast } = useToast();
  const { renderUrl } = useNavigation();
  const websiteIds = useMemo(() => data.map(row => row.id), [data]);
  const chartsQuery = useWebsiteListChartsQuery(websiteIds);
  const charts = chartsQuery.data?.data || {};
  const isChartLoading = chartsQuery.isLoading && !chartsQuery.data;
  const copyLabel = t.has(labels.copyDomain) ? t(labels.copyDomain) : 'Copy domain';

  const copyDomain = async (domain: string) => {
    const failureMessage = t.has(messages.domainCopyFailed)
      ? t(messages.domainCopyFailed, { domain })
      : `Could not copy domain: ${domain}. Clipboard access may be unavailable or denied.`;

    try {
      if (!navigator.clipboard?.writeText) {
        toast(failureMessage, { variant: 'error' });
        return;
      }

      await navigator.clipboard.writeText(domain);
    } catch {
      toast(failureMessage, { variant: 'error' });
      return;
    }

    toast(
      t.has(messages.domainCopied)
        ? t(messages.domainCopied, { domain })
        : `Copied domain: ${domain}`,
      { variant: 'success' },
    );
  };

  return (
    <DataTable {...props} data={data}>
      <DataColumn
        id="name"
        label={<SortableLabel label={t(labels.name)} sortKey="name" />}
        style={{ minWidth: 0 }}
      >
        {renderLink}
      </DataColumn>
      <DataColumn
        id="domain"
        label={<SortableLabel label={t(labels.domain)} sortKey="domain" />}
        style={{ minWidth: 0 }}
      >
        {(row: any) => {
          const domain = decodePunycodeDomain(row.domain);

          return (
            <Row alignItems="center" gap="2" minWidth="0">
              <Text truncate title={domain ?? undefined} style={{ minWidth: 0, maxWidth: '100%' }}>
                {domain}
              </Text>
              {domain && (
                <Button
                  variant="quiet"
                  aria-label={`${copyLabel}: ${domain}`}
                  title={copyLabel}
                  style={{ flexShrink: 0 }}
                  onPress={() => copyDomain(domain)}
                >
                  <Icon size="sm">
                    <Copy />
                  </Icon>
                </Button>
              )}
            </Row>
          );
        }}
      </DataColumn>
      <DataColumn
        id="chart"
        label={<span style={{ whiteSpace: 'normal' }}>{`${t(labels.visitors)} (7d)`}</span>}
        style={{ minWidth: 0 }}
      >
        {(row: any) => {
          const chart = charts[row.id];

          return (
            <WebsiteSparkline
              values={chart?.values}
              total={chart?.total}
              isLoading={isChartLoading}
            />
          );
        }}
      </DataColumn>
      <DataColumn
        id="created"
        label={
          <SortableLabel label={t(labels.created)} sortKey="createdAt" defaultDirection="desc" />
        }
        width="180px"
      >
        {(row: any) => <DateDistance date={new Date(row.createdAt)} />}
      </DataColumn>
      {showActions && (
        <DataColumn id="action" label=" " align="end" width="48px">
          {(row: any) => {
            const websiteId = row.id;

            return (
              <LinkButton href={renderUrl(`/websites/${websiteId}/settings`)} variant="quiet">
                <Icon>
                  <SquarePen />
                </Icon>
              </LinkButton>
            );
          }}
        </DataColumn>
      )}
    </DataTable>
  );
}
