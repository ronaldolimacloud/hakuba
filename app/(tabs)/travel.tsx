import { View } from "react-native";
import * as Form from "../../components/ui/form";
import {
  Segments,
  SegmentsContent,
  SegmentsList,
  SegmentsTrigger,
} from "../../components/ui/segments";

function SegmentsTest() {
  return (
    <Segments defaultValue="account">
      <SegmentsList>
        <SegmentsTrigger value="account">Account</SegmentsTrigger>
        <SegmentsTrigger value="password">Password</SegmentsTrigger>
      </SegmentsList>

      <SegmentsContent value="account">
        <Form.Text style={{ paddingVertical: 12, color: 'white' }}>Account Section</Form.Text>
      </SegmentsContent>
      <SegmentsContent value="password">
        <Form.Text style={{ paddingVertical: 12, color: 'white' }}> 
          Password Section
        </Form.Text>
      </SegmentsContent>
    </Segments>
  );
}

export default function Travel() {
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 60 }}>
        <Form.Text style={[Form.FormFont.caption, { 
          textTransform: "uppercase", 
          marginBottom: 16,
          color: '#666' 
        }]}>
          SEGMENTS
        </Form.Text>
        <SegmentsTest />
        <Form.Text style={[Form.FormFont.caption, { 
          marginTop: 16, 
          color: '#666' 
        }]}>
          Render tabbed content declaratively
        </Form.Text>
      </View>
    </View>
  );
}
