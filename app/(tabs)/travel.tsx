import * as AppleColors from "@bacons/apple-colors";
import { ScrollView, View } from "react-native";
import * as Form from "../../components/ui/form";
import { Rounded } from "../../components/ui/rounded";
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
        <Form.Text style={{ paddingVertical: 12, color: AppleColors.label }}>Account Section</Form.Text>
      </SegmentsContent>
      <SegmentsContent value="password">
        <Form.Text style={{ paddingVertical: 12, color: AppleColors.label }}> 
          Password Section
        </Form.Text>
      </SegmentsContent>
    </Segments>
  );
}

export default function Travel() {
  return (
    <ScrollView style={{ backgroundColor: '#000' }}>
      <View style={{ 
        paddingVertical: 16,
        paddingHorizontal: 16,
        gap: 24, // Space between cards
      }}>
        
        {/* Segments Card */}
        <View>
          <Form.Text style={[Form.FormFont.caption, { 
            textTransform: "uppercase", 
            marginBottom: 8,
            color: '#666',
            paddingHorizontal: 4,
          }]}>
            SEGMENTS
          </Form.Text>
          <Rounded 
            padding 
            style={{ 
              backgroundColor: '#1c1c1e',
            }}
          >
            <SegmentsTest />
          </Rounded>
          <Form.Text style={[Form.FormFont.caption, { 
            marginTop: 8, 
            color: '#666',
            paddingHorizontal: 4,
          }]}>
            Render tabbed content declaratively
          </Form.Text>
        </View>

      </View>
    </ScrollView>
  );
}
