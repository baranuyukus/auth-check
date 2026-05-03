import {reactExtension} from '@shopify/ui-extensions-react/customer-account';
import {
  Badge,
  BlockStack,
  Button,
  Card,
  Divider,
  InlineStack,
  Text,
} from '@shopify/ui-extensions-react/customer-account';
import {useMemo} from 'react';

const items = [
  {
    id: 'MA-0102',
    title: 'Denim Tears Mono Cotton Wreath Hoodie',
    variant: 'Navy On Navy',
    size: 'M',
    status: 'Authenticated',
    ownership: 'Owned',
    lastVerified: 'Today',
  },
  {
    id: 'MA-0187',
    title: 'Denim Tears Cotton Wreath T-Shirt',
    variant: 'Black',
    size: 'L',
    status: 'Transfer Pending',
    ownership: 'Awaiting transfer',
    lastVerified: '2 days ago',
  },
  {
    id: 'MA-0214',
    title: 'Archive Crewneck',
    variant: 'Heather Grey',
    size: 'S',
    status: 'Needs review',
    ownership: 'Claim available',
    lastVerified: 'Last week',
  },
];

export default reactExtension('customer-account.page.render', () => <App />);

function App() {
  const stats = useMemo(
    () => [
      {label: 'Authenticated items', value: items.length},
      {
        label: 'Claim / transfer queue',
        value: items.filter((item) => item.ownership !== 'Owned').length,
      },
      {label: 'Flagged items', value: 1},
    ],
    [],
  );

  return (
    <BlockStack spacing="loose">
      <Card>
        <BlockStack spacing="tight">
          <Text size="large">My Authenticated Items</Text>
          <Text size="small">
            Premium ownership records, verification status, and transfer tools
            live here.
          </Text>
        </BlockStack>
      </Card>

      <InlineStack spacing="tight">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <BlockStack spacing="extraTight">
              <Text size="small">{stat.label}</Text>
              <Text size="large">{String(stat.value)}</Text>
            </BlockStack>
          </Card>
        ))}
      </InlineStack>

      <BlockStack spacing="base">
        {items.map((item, index) => (
          <Card key={item.id}>
            <BlockStack spacing="base">
              <InlineStack spacing="tight" blockAlignment="center">
                <Card>
                  <BlockStack spacing="extraTight">
                    <Text size="large">
                      {item.title
                        .split(' ')
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')}
                    </Text>
                    <Text size="small">#{index + 1}</Text>
                  </BlockStack>
                </Card>

                <BlockStack spacing="extraTight">
                  <Text size="medium">{item.title}</Text>
                  <Text size="small">
                    {item.variant} / Size {item.size}
                  </Text>
                  <InlineStack spacing="tight">
                    <Badge>{item.status}</Badge>
                    <Badge>{item.ownership}</Badge>
                  </InlineStack>
                </BlockStack>
              </InlineStack>

              <Divider />

              <InlineStack spacing="tight">
                <Button onPress={() => console.log(`View ${item.id}`)}>
                  View certificate
                </Button>
                <Button onPress={() => console.log(`Transfer ${item.id}`)}>
                  Start transfer
                </Button>
                <Button onPress={() => console.log(`Lost ${item.id}`)}>
                  Mark lost
                </Button>
                <Button onPress={() => console.log(`Stolen ${item.id}`)}>
                  Report stolen
                </Button>
              </InlineStack>

              <InlineStack spacing="tight">
                <Text size="small">Auth ID: {item.id}</Text>
                <Text size="small">Last verified: {item.lastVerified}</Text>
              </InlineStack>
            </BlockStack>
          </Card>
        ))}
      </BlockStack>

      <Card>
        <BlockStack spacing="tight">
          <Text size="medium">Next actions</Text>
          <Text size="small">
            Once the backend is wired, this page can hydrate from the customer
            ownership registry and surface live transfer / claim workflows.
          </Text>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
