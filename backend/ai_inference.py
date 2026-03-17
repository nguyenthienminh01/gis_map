import os
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

def generate_ai_summary(summary):
    prompt = f"""You are a GIS analysis assistant.
Given a boundary polygon and a list of pole analysis results, interpret the spatial relationship.

Data:
- total poles: {summary['total']}
- poles inside: {summary['inside']}
- poles outside: {summary['outside']}
- average distance to boundary for all poles: {summary['avg_distance']} meters

Explain:
1. Whether boundary violations exist
2. Which poles are critical
3. Any anomalies in spatial distribution
"""
    
    api_key = os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("OPENAI_BASE_URL")
    model_name = os.environ.get("OPENAI_MODEL", "gpt-3.5-turbo")
    if api_key and OpenAI:
        try:
            client = OpenAI(
                api_key=api_key,
                base_url=base_url if base_url else None,
                timeout=3.0
            )
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a GIS analysis assistant."},
                    {"role": "user", "content": prompt}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            pass # fallback to mock
            
    # Mock fallback
    return f"""### AI Interpretation Summary (Mocked)

**1. Boundary Violations**
There are **{summary['outside']}** poles located OUTSIDE the boundary polygon. These represent immediate boundary violations that need to be addressed.
    
**2. Critical Poles**
The poles classified as OUTSIDE are critical. Since the average distance to the boundary is **{summary['avg_distance']}**, some poles might be significantly far from the intended perimeter or just slightly displaced. Further inspection of individual outside distances is recommended.
    
**3. Spatial Anomalies**
With {summary['inside']} out of {summary['total']} poles inside, the compliance rate is {round((summary['inside'] / summary['total']) * 100, 2) if summary['total'] else 0}%. If exterior poles are clustered or consistently leaning in one direction, this may indicate a systematic offset in coordinate projection or physical boundary drift.
"""
