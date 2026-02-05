import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Input,
  Textarea,
  Checkbox,
  Badge,
  Tooltip,
} from '@chakra-ui/react';
import { InfoIcon } from '@chakra-ui/icons';
import { SingleArmExtraction } from '../../types/extraction';

interface ExpandedSingleArmTableProps {
  data: SingleArmExtraction[];
  onUpdate: (index: number, field: keyof SingleArmExtraction, value: any) => void;
}

export default function ExpandedSingleArmTable({ data, onUpdate }: ExpandedSingleArmTableProps) {
  return (
    <Table variant="simple" size="sm">
      <Thead bg="gray.50" position="sticky" top={0} zIndex={1}>
        <Tr>
          <Th>Edit Status</Th>
          <Th>Treatment *</Th>
          <Th>Outcome *</Th>
          <Th>Time Point</Th>
          <Th>n *</Th>
          <Th>Events</Th>
          <Th>Time</Th>
          <Th>Mean</Th>
          <Th>SD</Th>
          <Th>TE</Th>
          <Th>seTE</Th>
          <Th>Page</Th>
          <Th>Table</Th>
          <Th>Ref</Th>
          <Th>Condition</Th>
          <Th>Age</Th>
          <Th>Severity</Th>
          <Th>Genotype</Th>
          <Th>Comorbidities</Th>
          <Th>Tx Experience</Th>
          <Th>Mono/Adjunct</Th>
          <Th>Notes</Th>
          <Th>Calc Notes</Th>
          <Th>Sensitivity</Th>
          <Th>Exclude</Th>
        </Tr>
      </Thead>
      <Tbody>
        {data.map((row, index) => (
          <Tr key={row.id} bg={row.manuallyEdited ? 'yellow.50' : undefined}>
            <Td>
              {row.manuallyEdited && (
                <Tooltip label="Manually edited">
                  <Badge colorScheme="orange" fontSize="xs">
                    <InfoIcon mr={1} />
                    Edited
                  </Badge>
                </Tooltip>
              )}
            </Td>
            <Td minW="150px">
              <Input
                size="sm"
                value={row.treatment}
                onChange={(e) => onUpdate(index, 'treatment', e.target.value)}
                fontWeight={!row.treatment ? 'bold' : undefined}
                borderColor={!row.treatment ? 'red.300' : undefined}
              />
            </Td>
            <Td minW="200px">
              <Input
                size="sm"
                value={row.measureName}
                onChange={(e) => onUpdate(index, 'measureName', e.target.value)}
                borderColor={!row.measureName ? 'red.300' : undefined}
              />
            </Td>
            <Td minW="120px">
              <Input
                size="sm"
                value={row.timePoint}
                onChange={(e) => onUpdate(index, 'timePoint', e.target.value)}
              />
            </Td>
            <Td>
              <Input
                type="number"
                size="sm"
                value={row.n}
                onChange={(e) => onUpdate(index, 'n', parseInt(e.target.value) || 0)}
                borderColor={!row.n || row.n <= 0 ? 'red.300' : undefined}
                w="80px"
              />
            </Td>
            <Td>
              <Input
                type="number"
                size="sm"
                value={row.event || ''}
                onChange={(e) => onUpdate(index, 'event', e.target.value ? parseInt(e.target.value) : null)}
                w="80px"
              />
            </Td>
            <Td>
              <Input
                type="number"
                size="sm"
                value={row.time || ''}
                onChange={(e) => onUpdate(index, 'time', e.target.value ? parseFloat(e.target.value) : null)}
                w="80px"
              />
            </Td>
            <Td>
              <Input
                type="number"
                step="0.01"
                size="sm"
                value={row.mean || ''}
                onChange={(e) => onUpdate(index, 'mean', e.target.value ? parseFloat(e.target.value) : null)}
                w="90px"
              />
            </Td>
            <Td>
              <Input
                type="number"
                step="0.01"
                size="sm"
                value={row.sd || ''}
                onChange={(e) => onUpdate(index, 'sd', e.target.value ? parseFloat(e.target.value) : null)}
                w="90px"
              />
            </Td>
            <Td>
              <Input
                type="number"
                step="0.01"
                size="sm"
                value={row.te || ''}
                onChange={(e) => onUpdate(index, 'te', e.target.value ? parseFloat(e.target.value) : null)}
                w="90px"
              />
            </Td>
            <Td>
              <Input
                type="number"
                step="0.01"
                size="sm"
                value={row.seTE || ''}
                onChange={(e) => onUpdate(index, 'seTE', e.target.value ? parseFloat(e.target.value) : null)}
                w="90px"
              />
            </Td>
            <Td>
              <Input
                size="sm"
                value={row.page}
                onChange={(e) => onUpdate(index, 'page', e.target.value)}
                w="80px"
              />
            </Td>
            <Td minW="150px">
              <Input
                size="sm"
                value={row.table}
                onChange={(e) => onUpdate(index, 'table', e.target.value)}
              />
            </Td>
            <Td minW="150px">
              <Input
                size="sm"
                value={row.ref}
                onChange={(e) => onUpdate(index, 'ref', e.target.value)}
              />
            </Td>
            <Td minW="150px">
              <Input
                size="sm"
                value={row.condition}
                onChange={(e) => onUpdate(index, 'condition', e.target.value)}
              />
            </Td>
            <Td minW="120px">
              <Input
                size="sm"
                value={row.age}
                onChange={(e) => onUpdate(index, 'age', e.target.value)}
              />
            </Td>
            <Td minW="150px">
              <Input
                size="sm"
                value={row.severity}
                onChange={(e) => onUpdate(index, 'severity', e.target.value)}
              />
            </Td>
            <Td minW="120px">
              <Input
                size="sm"
                value={row.conditionGenotype}
                onChange={(e) => onUpdate(index, 'conditionGenotype', e.target.value)}
              />
            </Td>
            <Td minW="150px">
              <Input
                size="sm"
                value={row.comorbidities}
                onChange={(e) => onUpdate(index, 'comorbidities', e.target.value)}
              />
            </Td>
            <Td minW="120px">
              <Input
                size="sm"
                value={row.treatmentExperience}
                onChange={(e) => onUpdate(index, 'treatmentExperience', e.target.value)}
              />
            </Td>
            <Td minW="120px">
              <Input
                size="sm"
                value={row.monoAdjunct}
                onChange={(e) => onUpdate(index, 'monoAdjunct', e.target.value)}
              />
            </Td>
            <Td minW="250px">
              <Textarea
                size="sm"
                value={row.notes}
                onChange={(e) => onUpdate(index, 'notes', e.target.value)}
                rows={2}
              />
            </Td>
            <Td minW="250px">
              <Textarea
                size="sm"
                value={row.calculationNotes}
                onChange={(e) => onUpdate(index, 'calculationNotes', e.target.value)}
                rows={2}
              />
            </Td>
            <Td>
              <Checkbox
                isChecked={row.sensitivity}
                onChange={(e) => onUpdate(index, 'sensitivity', e.target.checked)}
              />
            </Td>
            <Td>
              <Checkbox
                isChecked={row.exclude}
                onChange={(e) => onUpdate(index, 'exclude', e.target.checked)}
                colorScheme="red"
              />
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
