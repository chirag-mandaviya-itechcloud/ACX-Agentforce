public class ApplicantDetailsFormAssistController {
    public class Request {
        @InvocableVariable(required=true)
        public String fieldLabel;
        
        @InvocableVariable(required=true)
        public String fieldValue;
    }
    
    public class Response {
        @InvocableVariable public String result;
    }
    
    @InvocableMethod(label='Applicant Details Form Assist' description='publish the platform event for fill the form using chat')
    public static List<Response> firePlatformEvent(List<Request> requests) {
        List<Response> results = new List<Response>();
        
        for (Request req : requests) {
            System.debug('req : '+req);
            Response res = new Response();
            try {
                Map<String, String> jsonMap = new Map<String, String>();
                jsonMap.put(req.fieldLabel, req.fieldValue);
                
                String jsonString = JSON.serialize(jsonMap);
                
                Applicant_Details_From_Assist__e eventObj = new Applicant_Details_From_Assist__e(
                	Text_from_Agent__c = jsonString
                );
                
                Database.SaveResult sr = EventBus.publish(eventObj);
                
                if(sr.isSuccess()) {
                    res.result = 'Event Published';
                } else {
                    res.result ='Failed to Publish Event: ' + sr.getErrors()[0].getMessage();
                }
                
            } catch (Exception e) {
                System.debug('Exception: ' + e.getMessage());
                res.result = 'Error';
            }
            results.add(res);
        }
        System.debug('results : '+results);
        return results;
    }
}